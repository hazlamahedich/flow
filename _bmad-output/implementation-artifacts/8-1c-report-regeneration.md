# Story 8.1c: Weekly Client Reports — Re-Generation & Versioning

Status: ready-for-dev

## Story

As a workspace owner or admin,
I want to re-generate a report when underlying data changes,
So that reports reflect the latest information without losing historical versions.

## Dependencies

- Story 8-1a (generation + persistence) MUST be complete
- Story 8-1b (templates) RECOMMENDED but not strictly required (uses fixed order if templates absent)

## Scope

Add re-generation capability with versioning for sent reports.

**IN SCOPE:**
- "Regenerate" button on report detail page
- Draft report: update-in-place (upsert sections)
- Sent/viewed report: create new version (clone report row, copy sections)
- Optimistic concurrency control on re-generation
- Version history list on detail page

**OUT OF SCOPE:**
- Diff view between versions (v1.1)
- Automated re-generation triggers (cron — belongs to 8-2)
- Bulk re-generation (v1.1)

## Acceptance Criteria

0. **[AC0 — Test-First]** ≥10 failing tests in `8-1c-report-regeneration.spec.ts`.

1. **[AC1 — Draft Re-Generation]** Given a report in `draft` status:
   - "Regenerate" button is visible on detail page (Owner/Admin only)
   - Clicking re-runs aggregation across time_entries, invoices, agent_runs
   - Existing `weekly_report_sections` rows are upserted by `report_id` + `section_type`
   - `weekly_reports.updated_at` is set to `now()`
   - Uses optimistic lock: `WHERE updated_at = $currentUpdatedAt` — if stale, returns `FlowError` code `CONCURRENT_MODIFICATION`
   - All writes atomic via RPC

2. **[AC2 — Sent Report Versioning]** Given a report in `sent` or `viewed` status:
   - "Regenerate" creates a NEW `weekly_reports` row (clone of original with `status = 'draft'`)
   - New row gets `version = original.version + 1`, `parent_report_id = original.id`
   - New section rows are inserted (not upserted) pointing to new report
   - Original sent report is IMMUTABLE — never modified
   - User is redirected to the new draft version

3. **[AC3 — Version History]** Given a report with versions:
   - Detail page shows "Version X of Y" badge
   - Dropdown or sidebar shows all versions with: generated date, status, generated_by
   - Clicking a version navigates to `/reports/[reportId]`
   - Latest version is the default view

4. **[AC4 — Permissions]** Given workspace member roles:
   - Only Owner/Admin can regenerate
   - Member sees "Regenerate" button disabled with tooltip "Contact workspace owner"
   - RLS blocks UPDATE on `weekly_reports` for Member role

### Edge Case Matrix

| Case | Input / Condition | Expected Behavior | AC Ref |
|------|-------------------|-------------------|--------|
| EC1 | Two users click "Regenerate" on same draft simultaneously | First write wins; second gets `CONCURRENT_MODIFICATION` | AC1 |
| EC2 | User regenerates report that changed to `sent` between page load and click | Sent report rules apply — creates new version instead of updating in-place | AC2 |
| EC3 | Report deleted between page load and regenerate | Returns `FlowError` code `NOT_FOUND` | AC1 |
| EC4 | Version number exceeds INT_MAX | Unlikely with 2 billion reports; no special handling needed (documented risk) | AC2 |

## Pre-Dev Dependency Scan

- [x] `weekly_reports` table with `version`, `parent_report_id`, `generated_by` (8-1a) ✅
- [x] `weekly_report_sections` with `UNIQUE(report_id, section_type)` (8-1a) ✅
- [x] Report generation action (8-1a) ✅ — needs refactor to support both "new" and "re-generate" modes
- [x] Optimistic lock pattern (`updated_at` comparison) — used in time entry editing (Epic 5)

## Tasks / Subtasks

- [ ] Task 1 — Schema additions (AC: 2)
  - [ ] Subtask 1.1: Verify `version`, `parent_report_id` columns exist from 8-1a migration
  - [ ] Subtask 1.2: Add `idx_weekly_reports_parent_id` index if missing

- [ ] Task 2 — Regeneration Server Action (AC: 1, 2)
  - [ ] Subtask 2.1: `regenerateWeeklyReportAction` in `apps/web/app/(workspace)/reports/actions/regenerate-weekly-report.ts`
  - [ ] Subtask 2.2: Refactor generation logic into shared helper: `createOrUpdateWeeklyReport(params, mode: 'new' | 'regenerate')`
  - [ ] Subtask 2.3: Implement optimistic lock check in SQL/RPC
  - [ ] Subtask 2.4: Versioning logic: clone sent report → new row with incremented version

- [ ] Task 3 — UI (AC: 1, 2, 3)
  - [ ] Subtask 3.1: Add "Regenerate" button to detail page (conditionally rendered for Owner/Admin)
  - [ ] Subtask 3.2: Add version history sidebar/dropdown to detail page
  - [ ] Subtask 3.3: Show "Version X of Y" badge
  - [ ] Subtask 3.4: Loading state during regeneration

- [ ] Task 4 — Server Actions for history (AC: 3)
  - [ ] Subtask 4.1: `getReportVersionsAction({ parentReportId })` — list all versions

- [ ] Task 5 — ATDD red-phase
  - [ ] Subtask 5.1: `apps/web/__tests__/acceptance/epic-8/8-1c-report-regeneration.spec.ts`

## Dev Notes

### Architecture

- **Optimistic lock:** Use `UPDATE weekly_reports SET ... WHERE id = $1 AND updated_at = $2` — if no rows updated, another process modified it concurrently. Return `CONCURRENT_MODIFICATION`.
- **Versioning:** Reports form a linked list via `parent_report_id`. The "original" sent report has `parent_report_id = NULL`. Each regeneration creates a child with incremented `version`.
- **Immutability of sent reports:** Enforced at application layer (action checks status) AND database layer (trigger or application code). No database trigger needed — action logic is sufficient.
- **Shared generation logic:** Extract the aggregation + section creation from `generateWeeklyReportAction` into a shared helper (e.g., `packages/shared/weekly-report/generator.ts`) so both "new" and "regenerate" use identical aggregation logic.

### Edge Case Handling

- Concurrent regeneration: optimistic lock on `updated_at` handles this cleanly
- Status changed between load and click: re-check status at action time; if now `sent`, switch to "new version" flow

### Testing

- Integration: simulate concurrent regenerate requests, assert one wins and one gets error
- Unit: version increment logic, optimistic lock check
- ATDD: tests for EC1–EC3

### References

- [Source: 8-1a-weekly-reports-foundation.md]
- [Source: 8-1b-report-templates.md]
- [Source: packages/db/src/schema/weekly-reports.ts]

## Dev Agent Record

### Deferred Items (at close)

- Diff view between versions (v1.1)
- Bulk re-generation (v1.1)
- Automated scheduled re-generation (Story 8-2)

### Test Commit Record

| Test File | First Red Commit SHA | Date |
|-----------|---------------------|------|
| apps/web/__tests__/acceptance/epic-8/8-1c-report-regeneration.spec.ts | | |

### File List

_(to be filled at implementation time)_
