# Story 8.1b: Weekly Client Reports — Templates (Customization & Defaults)

Status: done

## Story

As a workspace owner or admin,
I want to customize report templates per client or workspace-wide,
So that each client receives reports with the right sections, order, and branding.

## Dependencies

- Story 8-1a (database schema + default template seed) MUST be complete before starting 8-1b.
- `report_templates` table, `weekly_reports.template_id` FK exist.

## Scope

Builds on 8-1a by adding template CRUD and enabling section customization.

**IN SCOPE:**
- Template CRUD UI (`/reports/templates`)
- Per-client template override
- Workspace default template fallback
- Section enablement/disablement validation (at least one section enabled)
- Template selection during report generation

**OUT OF SCOPE:**
- Report re-generation (8-1c)
- PDF export (8-1d)
- Portal sharing (8-2/9-2)
- Advanced branding (logo upload deferred to v1.1)

## Acceptance Criteria

0. **[AC0 — Test-First]** Unit test stubs are red before implementation. ≥8 failing tests in `8-1b-report-templates.spec.ts`.

1. **[AC1 — Template CRUD]** Given a user navigates to `/reports/templates`:
   - List shows workspace default template + per-client overrides
   - Each template card shows: name, enabled sections, last updated
   - Create new template (name + section toggles + accent color)
   - Edit existing template (update name, section toggles, accent color)
   - Delete per-client template (falls back to workspace default)
   - Cannot delete workspace default — must create replacement first

2. **[AC2 — Section Customization]** Given a template edit form:
   - User can enable/disable each of 4 sections: `time_summary`, `task_log`, `agent_activity`, `invoice_summary`
   - User can reorder sections via drag-and-drop or number inputs
   - Validation: at least one section MUST be enabled; all disabled → `SECTION_COUNT_MIN` error
   - Accent color picker (hex `#RRGGBB`, constrained to design system palette)
   - Logo URL is text field (not upload — deferred to v1.1)

3. **[AC3 — Template Selection in Generation]** Given user generates a report (from 8-1a flow):
   - System looks for per-client template first (`client_id = targetClientId`)
   - If none exists, falls back to workspace default (`client_id IS NULL`)
   - Report generation uses template's `enabled` flags to decide which sections to create
   - Disabled sections are omitted from the generated report
   - `template_snapshot` JSONB is stored on `weekly_reports` row at generation time

4. **[AC4 — Default Template Migration]** Given existing workspaces without a default template:
   - Migration seeds one default template per workspace (all 4 sections enabled, accent `#6366f1`)
   - New story: does NOT require modifying 8-1a workspace creation flow

### Edge Case Matrix

| Case | Input / Condition | Expected Behavior | AC Ref |
|------|-------------------|-------------------|--------|
| EC1 | Template with all sections disabled | Validation error `SECTION_COUNT_MIN`; form submit blocked | AC2 |
| EC2 | Delete workspace default when it's the only template | Blocked — UI shows "Create new default first" | AC1 |
| EC3 | Client with no per-client template + no workspace default | Falls back to hardcoded fallback (all 4 sections, indigo accent) | AC3 |
| EC4 | Template enabled sections change after report is generated | Historical reports remain unchanged (template_snapshot preserves state) | AC3 |

## Pre-Dev Dependency Scan

- [x] `report_templates` table (8-1a) ✅
- [x] `weekly_reports.template_id` FK (8-1a) ✅
- [x] `weekly_reports.template_snapshot` column (8-1a) ✅
- [x] Report generation action (8-1a) ✅ — needs extension to read template

## Tasks / Subtasks

- [x] Task 1 — Template CRUD Server Actions (AC: 1, 2)
  - [x] Subtask 1.1: `saveReportTemplateAction` — upsert with validation
  - [x] Subtask 1.2: `deleteReportTemplateAction` — with "default replacement" guard
  - [x] Subtask 1.3: `getReportTemplatesForWorkspaceAction` — list default + overrides
  - [x] Subtask 1.4: Zod schemas: `saveReportTemplateSchema`, `deleteReportTemplateSchema`

- [x] Task 2 — Template UI (AC: 1, 2)
  - [x] Subtask 2.1: `apps/web/app/(workspace)/reports/templates/page.tsx`
  - [x] Subtask 2.2: `apps/web/app/(workspace)/reports/templates/components/TemplateCard.tsx`
  - [x] Subtask 2.3: `apps/web/app/(workspace)/reports/templates/components/TemplateForm.tsx`
  - [x] Subtask 2.4: Section toggle + sort_order inputs
  - [x] Subtask 2.5: Color picker (design system palette constraint)

- [x] Task 3 — Wire templates into generation (AC: 3)
  - [x] Subtask 3.1: Update `generateWeeklyReportAction` to resolve template (client → default → fallback)
  - [x] Subtask 3.2: Filter sections by template `enabled` flags
  - [x] Subtask 3.3: Store `template_snapshot` on report row at generation time

- [x] Task 4 — Default template backfill migration
  - [x] Subtask 4.1: Migration seeds default template for all existing workspaces

- [x] Task 5 — ATDD red-phase
  - [x] Subtask 5.1: `apps/web/__tests__/acceptance/epic-8/8-1b-report-templates.spec.ts`

## Dev Notes

### Architecture

- Template resolution order: `per-client` → `workspace default` → `hardcoded fallback`
- `template_snapshot` on `weekly_reports` ensures historical reproducibility — template changes never mutate past reports
- JSONB `sections_config` shape:
  ```json
  {
    "time_summary": { "enabled": true, "sort_order": 1 },
    "task_log": { "enabled": true, "sort_order": 2 },
    "agent_activity": { "enabled": true, "sort_order": 3 },
    "invoice_summary": { "enabled": true, "sort_order": 4 }
  }
  ```
- Color picker: constrained to design system palette (indigo #6366f1, blue #3b82f6, violet #8b5cf6, etc.)

### Permissions

- Owner/Admin: full CRUD on templates
- Member: SELECT only (view templates, cannot modify)
- ClientUser: no access

### Testing

- Unit: template resolution logic (pure function), section validation
- Integration: save/load template round-trip, default fallback
- ATDD: 8+ tests covering CRUD, validation, generation wiring

### References

- [Source: 8-1a-weekly-reports-foundation.md] — prerequisite story
- [Source: docs/project-context.md#CRITICAL: Money is integers in cents]
- [Source: packages/db/src/schema/weekly-reports.ts] — created in 8-1a

## Dev Agent Record

### Deferred Items (at close)

- Logo upload (v1.1)
- Advanced branding: custom fonts, footer text (v1.1)

### Test Commit Record

| Test File | First Red Commit SHA | Date |
|-----------|---------------------|------|
| apps/web/__tests__/acceptance/epic-8/8-1b-report-templates.spec.ts | | |

### File List

_(to be filled at implementation time)_

### Review Findings

**Resolved (2026-05-29):**

- [x] [Review][Decision→Patch] accentColor vs accent_color JSONB key mismatch — fixed: standardized to camelCase in foundation migration + RPC
- [x] [Review][Decision→Patch] explicit templateId not scoped to client in generation — fixed: added `.or()` filter for client_id match
- [x] [Review][Patch] Delete redundant 8-1b migration (wrong timestamp, duplicates foundation seed) [supabase/migrations/20260528000001_8_1b_report_templates.sql]
- [x] [Review][Patch] Remove duplicate DESIGN_SYSTEM_PALETTE + re-validation from save action [save-report-template.ts:13-17,62-77]
- [x] [Review][Patch] TemplateCard reads sortOrder instead of sort_order [TemplateCard.tsx:12,15]
- [x] [Review][Patch] Server action errors silently swallowed in UI [ClientTemplatePage.tsx:21,54]
- [x] [Review][Patch] TemplateForm stale data on cancel (added key prop) [ClientTemplatePage.tsx:102]
- [x] [Review][Patch] No workspace-scoped clientId validation on save [save-report-template.ts:60]
- [x] [Review][Patch] TemplateCard invalid date guard [TemplateCard.tsx:86]

**Deferred:**

- [x] [Review][Defer] Missing Zod validation at DB result boundaries (systemic pattern) — deferred, pre-existing
- [x] [Review][Defer] safeStr produces invalid datetime strings in generateWeeklyReportAction — deferred, 8-1a code
- [x] [Review][Defer] No cross-workspace template access test — deferred, test gap
- [x] [Review][Defer] No pagination on getReportTemplatesForWorkspaceAction — deferred, MVP scope
- [x] [Review][Defer] safeNum doesn't exclude negative financial values — deferred, 8-1a code
- [x] [Review][Defer] updated_at trigger missing on report_templates — deferred, 8-1a schema, save action sets manually
