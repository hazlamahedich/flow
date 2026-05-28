# Story 8.1: Weekly Client Reports

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to generate weekly client reports aggregating time, tasks, and agent activity,
so that I can review and share client progress.

## Acceptance Criteria

0. **[AC0 — Test-First]** Unit test stubs exist and are red before implementation begins. Story cannot be marked `in-progress` until test file with failing tests is created.

1. **[AC1 — Report Generation RPC]** Given a `client_id` and a date range (`period_start`, `period_end`), a `generateWeeklyReportAction` Server Action returns aggregated data: total time logged (sum of `duration_minutes` from `time_entries`), invoice summary (total invoiced, total paid, outstanding balance from `invoices` + `invoice_payments`), and agent activity summary (count of `agent_runs` by `action_type` and `status` for that client in the period). `ActionResult<{ report: WeeklyReport; sections: WeeklyReportSection[] }>` is used. Invalid date ranges (`period_start > period_end`) return `FlowError` with code `INVALID_DATE_RANGE`.

2. **[AC2 — Report Persistence]** Given aggregated report data, the system persists a header row in `weekly_reports` and section rows in `weekly_report_sections`. `weekly_reports` columns: `id`, `workspace_id`, `client_id`, `period_start` (date), `period_end` (date), `status` (`draft` | `sent` | `viewed` | `approved`), `template_id` (nullable fk), `generated_at`, `sent_at` (nullable), `created_at`, `updated_at`. `weekly_report_sections` columns: `id`, `report_id`, `section_type` (`time_summary` | `task_log` | `agent_activity` | `invoice_summary`), `title`, `content` (JSONB), `sort_order`, `created_at`. Pre-computed aggregation stored at generation time; detail views never run live aggregation.

3. **[AC3 — Report List UI]** Given the user navigates to `/reports`, they see a list of generated reports per client, sorted by `generated_at` desc. Each row shows: client name, period, status badge, and generated date. Empty state shows "No reports yet — generate your first weekly report" CTA. List paginated at 20 items per page. Skeleton UI matches content shape during load. Navigation from list to detail via `/reports/[reportId]`.

4. **[AC4 — Report Detail View]** Given the user opens a report detail page, they see formatted sections: **Time Summary** (total hours, billable vs non-billable, day-by-day breakdown), **Task Log** (time entries with notes, grouped by project), **Agent Activity** (agent run counts by type, successful vs failed), **Invoice Summary** (invoiced amount, paid, outstanding — if template enables it). Sections render in order defined by template `sort_order`. Each section is a Server Component where possible; interactive elements (PDF export, share) are Client Components. Detail page includes "Regenerate" button for re-running aggregation.

5. **[AC5 — Report Templates]** Given a user customizes a report template for a client, the system stores the template in `report_templates`: `id`, `workspace_id`, `client_id` (nullable — null = workspace default), `name`, `sections_config` (JSONB mapping `section_type → { enabled: boolean, sortOrder: number }`), `branding` (JSONB: `{ accentColor?: string, logoUrl?: string | null }`), `created_at`, `updated_at`. Default template for every workspace on creation has all 4 sections enabled. Report generation respects template `enabled` flags — disabled sections are omitted. Template UI accessible at `/reports/templates`.

6. **[AC6 — Report Re-generation]** Given a report exists in `draft` status and underlying data (time entries, invoices, agent runs) has changed, the user can click "Regenerate" to re-run aggregation. Re-generation updates existing `weekly_report_sections` rows (upsert by `report_id` + `section_type`) and sets `updated_at = now()`. If report status is `sent` or `viewed`, re-generation creates a NEW report record (versioning) rather than mutating the sent one. Sent reports are immutable.

7. **[AC7 — PDF Export]** Given a report in any status, the user can export it as PDF. PDF generation is server-side (spike decision: use `puppeteer` headless Chrome or `@react-pdf/renderer`). If using Puppeteer, a dedicated route handler `/api/reports/[reportId]/pdf` returns the PDF stream. PDF styling reuses portal brand tokens (`accentColor` from template). PDF export is a P1 feature — can be stubbed with a placeholder if spike uncovers complexity, but the route and UI button must exist.

8. **[AC8 — Portal Sharing]** Given a report is ready to share, the system creates a delivery token (reuse `signDeliveryToken` pattern from Epic 7 invoice delivery) scoped to `reportId` + `clientId`. Portal sharing URL: `/portal/[clientSlug]/reports/[token]`. RLS policy ensures the token-authorized client user can ONLY view reports for their own `client_id`. Report sharing marks status as `sent`. Client portal view shows report in read-only mode with "Approve" and "Request Changes" actions (UI stubbed; logic in Story 8.2/9.2).

### Edge Case Matrix

| Case | Input / Condition | Expected Behavior | AC Ref |
|------|-------------------|-------------------|--------|
| EC1 | Client has zero time entries in period | Time Summary shows 0h with "No time logged" message; report still generated | AC1, AC4 |
| EC2 | Client has zero invoices in period | Invoice Summary omitted if template enables it but no data exists; OR shows $0 with note | AC1, AC4 |
| EC3 | Concurrent regeneration (two users click at same time) | First write wins; second gets optimistic lock failure or idempotent result (use `report_id` + `updated_at` check) | AC6 |
| EC4 | Report re-generated after sent | Creates new report version instead of updating sent report | AC6 |
| EC5 | Template with all sections disabled | Validation error: at least one section must be enabled (`SECTION_COUNT_MIN`) | AC5 |
| EC6 | Date range spans > 31 days | Validation error: max 31 days per report (`PERIOD_TOO_LONG`) | AC1 |

## Pre-Dev Dependency Scan

- [x] Graphify query run — key dependencies listed below
- [ ] Dependencies:
  - `time_entries` table (Epic 5) ✅
  - `invoices`, `invoice_line_items`, `invoice_payments` tables (Epic 7) ✅
  - `agent_runs` table (Epic 2) ✅
  - `clients` table (Epic 3) ✅
  - `projects` table (Epic 3) ✅
  - `report_templates` table (NEW — this story)
  - `weekly_reports` table (NEW — this story)
  - `weekly_report_sections` table (NEW — this story)
  - Trust gate / approval queue (Epic 2) — NOT needed for 8.1 (agent auto-drafts in 8-2)
  - Delivery token pattern (Epic 7) ✅ — reuse `packages/agents/invoice-delivery/token.ts`
- [ ] UX AC review — no ambiguous ACs; portal sharing UI is stub (full flow in 8.2/9.2)
- [ ] Architect sign-off: [pending — confirm PDF spike approach]

## Tasks / Subtasks

- [ ] Task 1 — Database migration: `weekly_reports`, `weekly_report_sections`, `report_templates` tables with RLS (AC: 2, 5)
  - [ ] Subtask 1.1: Write migration SQL with `::text` cast RLS policies
  - [ ] Subtask 1.2: Add Drizzle schema definitions in `packages/db/src/schema/weekly-reports.ts`
  - [ ] Subtask 1.3: Export from `packages/db/src/schema/index.ts`
  - [ ] Subtask 1.4: pgTAP RLS tests for all three tables
- [ ] Task 2 — Report generation RPC + Server Action (AC: 1)
  - [ ] Subtask 2.1: Zod schema `generateWeeklyReportSchema` in `packages/validators/reports.ts`
  - [ ] Subtask 2.2: `generateWeeklyReportAction` in `apps/web/app/(workspace)/reports/actions/generate-weekly-report.ts`
  - [ ] Subtask 2.3: Aggregation query (time entries, invoices, agent runs) — use Supabase RPC or complex `.from()`
  - [ ] Subtask 2.4: Unit test: aggregation logic with mocked data
- [ ] Task 3 — Report persistence layer (AC: 2)
  - [ ] Subtask 3.1: Insert `weekly_reports` header row
  - [ ] Subtask 3.2: Insert `weekly_report_sections` rows (4 sections max)
  - [ ] Subtask 3.3: `getWeeklyReportById` Server Action
  - [ ] Subtask 3.4: `getWeeklyReportsForClient` Server Action (paginated)
- [ ] Task 4 — Report list + detail UI (AC: 3, 4)
  - [ ] Subtask 4.1: `apps/web/app/(workspace)/reports/page.tsx` — list view
  - [ ] Subtask 4.2: `apps/web/app/(workspace)/reports/[reportId]/page.tsx` — detail view
  - [ ] Subtask 4.3: Section components: `TimeSummarySection`, `TaskLogSection`, `AgentActivitySection`, `InvoiceSummarySection`
  - [ ] Subtask 4.4: Skeleton UI for list and detail
  - [ ] Subtask 4.5: Empty state component
- [ ] Task 5 — Report templates UI + Server Action (AC: 5)
  - [ ] Subtask 5.1: `saveReportTemplateAction` with upsert
  - [ ] Subtask 5.2: `apps/web/app/(workspace)/reports/templates/page.tsx`
  - [ ] Subtask 5.3: Default template seed on workspace creation (update workspace creation flow or add migration default)
- [ ] Task 6 — Report re-generation (AC: 6)
  - [ ] Subtask 6.1: `regenerateWeeklyReportAction` with versioning logic
  - [ ] Subtask 6.2: UI "Regenerate" button on detail page
- [ ] Task 7 — PDF export spike + route (AC: 7)
  - [ ] Subtask 7.1: Spike Puppeteer vs `@react-pdf/renderer`
  - [ ] Subtask 7.2: `/api/reports/[reportId]/pdf` route handler
  - [ ] Subtask 7.3: PDF export button in detail view
- [ ] Task 8 — Portal sharing token + route (AC: 8)
  - [ ] Subtask 8.1: Reuse `signDeliveryToken` for report sharing
  - [ ] Subtask 8.2: Portal route stub `/portal/[clientSlug]/reports/[token]`
  - [ ] Subtask 8.3: RLS policy for token-authorized report read
- [ ] Task 9 — ATDD red-phase compliance
  - [ ] Subtask 9.1: Ensure `apps/web/__tests__/acceptance/epic-8/8-1-weekly-client-reports.spec.ts` tests turn from `.skip` to `.todo` or passing
  - [ ] Subtask 9.2: Add any missing unit tests for aggregation logic

## Dev Notes

### Architecture & Constraints

- **Pre-compute at generation time** — Report detail views MUST NOT run live aggregation across `time_entries`, `invoices`, and `agent_runs`. All data is snapshotted into `weekly_report_sections.content` JSONB at generation. This prevents N+1 queries and ensures report immutability after sent.
- **RLS is non-negotiable** — All three new tables (`weekly_reports`, `weekly_report_sections`, `report_templates`) get RLS policies using the canonical `::text` cast pattern. See `supabase/migrations/20260428000006_trust_rls_policies.sql` for the canonical policy template.
- **Workspace-scoped queries** — Every query includes `workspace_id` filter. No exceptions.
- **Server Components by default** — List page and detail page are Server Components. PDF export button and template toggles are Client Components.
- **ActionResult<T>** — All Server Actions return `ActionResult`. Use `createFlowError` for business validation errors (`INVALID_DATE_RANGE`, `PERIOD_TOO_LONG`, `SECTION_COUNT_MIN`).
- **Idempotency** — Report generation is NOT naturally idempotent (each click creates a new report). Re-generation uses `report_id` + `updated_at` optimistic check to prevent clobbering.

### Database Schema Details

```sql
-- weekly_reports
CREATE TABLE weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'approved')),
  template_id uuid REFERENCES report_templates(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- weekly_report_sections
CREATE TABLE weekly_report_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
  section_type text NOT NULL CHECK (section_type IN ('time_summary', 'task_log', 'agent_activity', 'invoice_summary')),
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- report_templates
CREATE TABLE report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  sections_config jsonb NOT NULL DEFAULT '{}',
  branding jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Indexes:**
- `weekly_reports`: `(workspace_id, client_id, generated_at DESC)`, `(workspace_id, status)`
- `weekly_report_sections`: `(report_id, section_type)` UNIQUE partial index? No — one section type per report is fine, but re-generation may delete+insert. Use `(report_id, sort_order)`.
- `report_templates`: `(workspace_id, client_id)` — one template per client max, plus workspace default where `client_id IS NULL`.

### Source Tree Components to Touch

| File / Directory | Purpose |
|---|---|
| `supabase/migrations/20260603000001_weekly_reports.sql` | Migration (use next available timestamp) |
| `packages/db/src/schema/weekly-reports.ts` | Drizzle schema for all three tables |
| `packages/db/src/schema/index.ts` | Barrel export (package boundary only) |
| `packages/validators/reports.ts` | Zod schemas: `generateWeeklyReportSchema`, `saveReportTemplateSchema`, `regenerateWeeklyReportSchema` |
| `apps/web/app/(workspace)/reports/page.tsx` | Report list |
| `apps/web/app/(workspace)/reports/[reportId]/page.tsx` | Report detail |
| `apps/web/app/(workspace)/reports/templates/page.tsx` | Template settings |
| `apps/web/app/(workspace)/reports/actions/generate-weekly-report.ts` | Generate action |
| `apps/web/app/(workspace)/reports/actions/get-weekly-reports.ts` | List action |
| `apps/web/app/(workspace)/reports/actions/get-weekly-report-by-id.ts` | Detail action |
| `apps/web/app/(workspace)/reports/actions/save-report-template.ts` | Template action |
| `apps/web/app/(workspace)/reports/actions/regenerate-weekly-report.ts` | Regenerate action |
| `apps/web/app/(workspace)/reports/components/ReportList.tsx` | List component |
| `apps/web/app/(workspace)/reports/components/ReportDetail.tsx` | Detail shell |
| `apps/web/app/(workspace)/reports/components/TimeSummarySection.tsx` | Section component |
| `apps/web/app/(workspace)/reports/components/TaskLogSection.tsx` | Section component |
| `apps/web/app/(workspace)/reports/components/AgentActivitySection.tsx` | Section component |
| `apps/web/app/(workspace)/reports/components/InvoiceSummarySection.tsx` | Section component |
| `apps/web/app/(workspace)/reports/components/ReportTemplateForm.tsx` | Template UI |
| `apps/web/app/(workspace)/reports/components/ReportSkeleton.tsx` | Skeleton |
| `apps/web/app/(workspace)/reports/components/EmptyReportsState.tsx` | Empty state |
| `apps/web/app/api/reports/[reportId]/pdf/route.ts` | PDF export route |
| `apps/web/app/portal/[slug]/reports/[token]/page.tsx` | Portal report view (stub) |
| `packages/agents/weekly-report/` | **DO NOT CREATE YET** — Weekly Report Agent belongs to Story 8.2 |

### Testing Standards

- **Unit tests**: Aggregation logic (pure functions), Zod schema validation, template section enablement logic. No database.
- **Integration tests**: Server Actions with Supabase local, RLS policy assertions for `weekly_reports`, `weekly_report_sections`, `report_templates`.
- **RLS tests**: Every policy tested per role (Owner, Admin, Member, ClientUser). Cross-tenant isolation: Workspace A user gets zero results from Workspace B.
- **ATDD**: `apps/web/__tests__/acceptance/epic-8/8-1-weekly-client-reports.spec.ts` — 13 skipped tests. Convert to `.todo` or make pass during implementation.
- **E2E**: `tests/e2e/epic-8-reporting.spec.ts` — tests E2E-001 through E2E-004 relate to 8.1.

### Project Structure Notes

- Feature folder: `reports/` under `app/(workspace)/`. Follows existing pattern: `clients/`, `invoices/`, `agents/`.
- Actions colocated: `reports/actions/` not a shared root `actions/` folder.
- No barrel files inside `reports/components/` — import each component explicitly.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8: Reporting & Client Health]
- [Source: _bmad-output/implementation-artifacts/epic-8-kickoff-2026-05-27.md]
- [Source: docs/project-context.md#Critical Implementation Rules]
- [Source: supabase/migrations/20260428000006_trust_rls_policies.sql] — canonical RLS pattern
- [Source: packages/agents/invoice-delivery/token.ts] — delivery token pattern for portal sharing
- [Source: packages/db/src/schema/invoices.ts] — existing schema pattern (bigint cents, checks, indexes)
- [Source: packages/db/src/schema/time-entries.ts] — time entry schema for aggregation
- [Source: packages/db/src/schema/agent-runs.ts] — agent run schema for activity summary

## Dev Agent Record

### Agent Model Used

_(to be filled at implementation time)_

### Debug Log References

_(to be filled at implementation time)_

### Completion Notes List

_(to be filled at implementation time)_

### Deferred Items (at close)

_Count recorded at each code review pass. If >5, require Architect + PM approval._

- PDF export implementation (spike-dependent; route + button must exist, generation can defer)
- Portal sharing full approval/change-request flow (stubbed; logic in 8.2/9.2)
- Default template auto-creation on workspace creation (can seed via migration or add to workspace creation Server Action)

### Test Commit Record

_Epic 5 retro A2: Record the SHA of the first failing test commit (red phase) before any implementation commit._

| Test File | First Red Commit SHA | Date |
|-----------|---------------------|------|
| apps/web/__tests__/acceptance/epic-8/8-1-weekly-client-reports.spec.ts | | |

### File List

_(to be filled at implementation time)_
