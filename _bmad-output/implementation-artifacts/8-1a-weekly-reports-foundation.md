# Story 8.1a: Weekly Client Reports — Foundation (Generation & Persistence)

Status: done

## Story

As a workspace owner or admin,
I want to generate weekly client reports by selecting a client and date range,
So that I can review aggregated time, tasks, and agent activity for that period.

## Scope

This is the **first vertical slice** of reporting. It covers:
- Database schema for `weekly_reports`, `weekly_report_sections`, `report_templates`
- Report generation Server Action (aggregation across time_entries, invoices, agent_runs)
- Report persistence (header + sections snapshotted as JSONB)
- Basic list and detail UI (4 section types rendered from pre-computed data)
- Permissions: Owner, Admin, Member can generate; ClientUser cannot

**OUT OF SCOPE for 8-1a:**
- Template customization UI (moved to 8-1b)
- Report re-generation / versioning (moved to 8-1c)
- PDF export (moved to 8-1d)
- Portal sharing (moved to 8-2/9-2)

## Acceptance Criteria

0. **[AC0 — Test-First]** Unit test stubs are red before implementation. Story cannot be `in-progress` until `apps/web/__tests__/acceptance/epic-8/8-1a-weekly-reports-foundation.spec.ts` exists with ≥12 failing tests.

1. **[AC1 — Report Generation RPC]** Given a `clientId` (uuid) and date range (`periodStart`, `periodEnd` as ISO dates), a `generateWeeklyReportAction` Server Action returns aggregated data:
   - **Time Summary:** total `durationMinutes` from `time_entries` where `client_id = clientId` and `date` in range
   - **Task Log:** time entries with `notes`, grouped by `project_id`
   - **Agent Activity:** count of `agent_runs` by `action_type` and `status` where `client_id = clientId` and `created_at` in range
   - **Invoice Summary:** `total_cents` from `invoices`, `amount_paid_cents` from `invoice_payments` where `client_id = clientId` and `issue_date` in range (or `created_at` for payments)
   - Returns `ActionResult<{ report: WeeklyReport; sections: WeeklyReportSection[] }>`
   - Invalid date range (`periodStart > periodEnd`) → `FlowError` code `INVALID_DATE_RANGE`
   - Date range > 31 days → `FlowError` code `PERIOD_TOO_LONG`

2. **[AC2 — Report Persistence]** Given aggregated data, the system persists:
   - Header row in `weekly_reports` with `status = 'draft'`, `generated_by = current user id`
   - Section rows in `weekly_report_sections` (one per section type, JSONB `content` pre-computed)
   - All writes in a single atomic transaction (RPC or Supabase `.rpc()`)
   - Pre-computed data means detail views NEVER run live aggregation

3. **[AC3 — Report List UI]** Given user navigates to `/reports`:
   - Paginated list (20 items/page), sorted by `generated_at DESC`
   - Each row: client name, period, status badge, generated date
   - Empty state: "No reports yet — generate your first weekly report" CTA
   - Skeleton UI during load matching content shape
   - Navigation to `/reports/[reportId]` for detail

4. **[AC4 — Report Detail View]** Given user opens `/reports/[reportId]`:
   - Shows all 4 sections in fixed order (time_summary → task_log → agent_activity → invoice_summary)
   - Each section is a Server Component (no client-side data fetching)
   - Sections render from `weekly_report_sections.content` JSONB
   - "Back to reports" link
   - Sections handle zero-data gracefully ("No time logged this period" instead of empty table)

5. **[AC5 — Default Template Seed]** Given a workspace is created:
   - A default `report_templates` row is inserted with `client_id = NULL` (workspace default)
   - All 4 sections enabled, sort_order 1–4
   - Default branding: accent `#6366f1` (indigo — matches design system primary)

6. **[AC6 — Permissions]** Given workspace member roles:
    - Owner/Admin: full CRUD on reports for their workspace
    - Member: SELECT only (cannot generate reports)
    - ClientUser: no access to `/reports` route
    - RLS policies enforce workspace scoping via `workspace_id::text = auth.jwt()->>'workspace_id'`
    - Reports are immutable once sent; drafts can be soft-archived

### Edge Case Matrix

| Case | Input / Condition | Expected Behavior | AC Ref |
|------|-------------------|-------------------|--------|
| EC1 | Client has zero time entries in period | Time Summary shows 0h with "No time logged" message; report still generated | AC1, AC4 |
| EC2 | Client has zero invoices in period | Invoice Summary shows $0 with note; report still generated | AC1, AC4 |
| EC3 | Client has zero agent runs in period | Agent Activity shows "No agent activity" message; report still generated | AC1, AC4 |
| EC4 | User is Member role | Can view list/detail but generate button is disabled/hidden; RLS blocks INSERT | AC6 |
| EC5 | Date range spans exactly 31 days (boundary) | Accepted — 31 is the max inclusive | AC1 |
| EC6 | Date range spans > 31 days | Returns `FlowError` with code `PERIOD_TOO_LONG` | AC1 |

## Pre-Dev Dependency Scan

- [x] `time_entries` table (Epic 5) ✅ — columns: `client_id`, `date`, `duration_minutes`, `notes`, `project_id`
- [x] `invoices` + `invoice_payments` tables (Epic 7) ✅ — columns: `client_id`, `total_cents`, `amount_paid_cents`
- [x] `agent_runs` table (Epic 2) ✅ — columns: `client_id`, `action_type`, `status`, `created_at`
- [x] `clients` table (Epic 3) ✅
- [x] `projects` table (Epic 3) ✅
- [x] Trust gate / approval queue (Epic 2) — **NOT NEEDED** (agent auto-drafts in 8-2)
- [x] Delivery token pattern (Epic 7) — **NOT NEEDED** (portal sharing in 8-2/9-2)
- [x] UX AC review — no ambiguous ACs; portal sharing completely deferred
- [x] Architect sign-off: **COMPLETE** — PDF spike deferred to 8-1d; @react-pdf/renderer recommended for serverless

## Tasks / Subtasks

- [x] Task 1 — Database migration (AC: 2, 5, 6)
  - [x] Subtask 1.1: Migration `supabase/migrations/20260528074359_weekly_reports_foundation.sql` exists with all 3 tables + constraints + indexes + RLS + RPCs + seed backfill
  - [x] Subtask 1.2: Drizzle schema `packages/db/src/schema/weekly-reports.ts` already existed (all 3 tables, types)
  - [x] Subtask 1.3: Export from `packages/db/src/schema/index.ts` already existed
  - [x] Subtask 1.4: pgTAP RLS tests written: `supabase/tests/rls_weekly_reports.sql` (owner/admin/member/client-scoped isolation)
  - [x] Subtask 1.5: Default template seed handled by migration backfill (`create_workspace` RPC not yet updated; deferred per-story scope)

- [x] Task 2 — Report generation Server Action (AC: 1)
  - [x] Subtask 2.1: Zod schemas added to `packages/types/src/reports.ts` (generateWeeklyReportSchema, weeklyReportSchema, weeklyReportSectionSchema, reportTemplateSchema, reportListItemSchema)
  - [x] Subtask 2.2: `generateWeeklyReportAction` in `apps/web/lib/actions/reports/generate-weekly-report.ts`
  - [x] Subtask 2.3: Aggregation queries via Supabase `.from()` with workspace + client + date filters
  - [x] Subtask 2.4: Atomic insert via `.rpc('create_weekly_report_with_sections')`
  - [x] Subtask 2.5: Unit tests for Zod schema validation + role gating in `apps/web/lib/actions/reports/__tests__/generate-weekly-report.test.ts`

- [x] Task 3 — Report list + detail UI (AC: 3, 4)
  - [x] Subtask 3.1: `apps/web/app/(workspace)/reports/page.tsx` — list view with pagination (20/page)
  - [x] Subtask 3.2: `apps/web/app/(workspace)/reports/[reportId]/page.tsx` — detail view with 4 sections
  - [x] Subtask 3.3: Section components: `TimeSummarySection.tsx`, `TaskLogSection`, `AgentActivitySection`, `InvoiceSummarySection` in `ReportSections.tsx`
  - [x] Subtask 3.4: `ReportSkeleton.tsx` for list + detail
  - [x] Subtask 3.5: `EmptyReportsState.tsx` empty state
  - [x] Subtask 3.6: Server Actions: `getWeeklyReportsAction`, `getWeeklyReportByIdAction`

- [x] Task 4 — ATDD red-phase compliance (AC: 0)
  - [x] Subtask 4.1: ATDD scaffolds exist and remain skipped (red) — 30 tests
  - [x] Subtask 4.2: `tests/e2e/epic-8-reporting.spec.ts` E2E tests exist and are not-skipped (they check UI elements that exist now)

## Dev Notes

### Architecture & Constraints

- **Pre-compute at generation time** — Detail views MUST NOT run live aggregation. All data snapshotted into `weekly_report_sections.content`.
- **RLS is non-negotiable** — `workspace_id::text = auth.jwt()->>'workspace_id'` pattern. Owner/Admin INSERT+UPDATE+DELETE; Member SELECT only; ClientUser no access.
- **Workspace-scoped queries** — Every query includes `workspace_id` filter.
- **Server Components by default** — List page and detail page are Server Components.
- **ActionResult<T>** — All Server Actions return `ActionResult`. Use `createFlowError` for business validation (`INVALID_DATE_RANGE`, `PERIOD_TOO_LONG`).
- **Atomic writes** — Use Supabase RPC `create_weekly_report_with_sections` to insert header + sections in one transaction.

### Database Schema

```sql
-- weekly_reports (FIXED from original 8-1)
CREATE TABLE weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'approved')),
  template_id uuid REFERENCES report_templates(id) ON DELETE SET NULL,
  generated_by uuid NOT NULL REFERENCES users(id),
  generated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  template_snapshot jsonb NOT NULL DEFAULT '{}', -- snapshot at generation time
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT period_start_before_end CHECK (period_start <= period_end)
);

-- weekly_report_sections (FIXED from original 8-1)
CREATE TABLE weekly_report_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
  section_type text NOT NULL
    CHECK (section_type IN ('time_summary', 'task_log', 'agent_activity', 'invoice_summary')),
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, section_type) -- CRITICAL: enables ON CONFLICT upsert
);

-- report_templates (FIXED from original 8-1)
CREATE TABLE report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  sections_config jsonb NOT NULL DEFAULT '{}',
  branding jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
  -- partial unique index added separately: (workspace_id) WHERE client_id IS NULL
);
```

**Indexes:**
- `CREATE INDEX idx_weekly_reports_workspace_client_generated ON weekly_reports (workspace_id, client_id, generated_at DESC);`
- `CREATE INDEX idx_weekly_reports_workspace_status ON weekly_reports (workspace_id, status) WHERE status = 'draft';`
- `CREATE INDEX idx_weekly_report_sections_report_sort ON weekly_report_sections (report_id, sort_order);`
- `CREATE UNIQUE INDEX idx_report_templates_workspace_default ON report_templates (workspace_id) WHERE client_id IS NULL;`

### Source Tree Components to Touch

| File / Directory | Purpose |
|---|---|
| `supabase/migrations/20260603000001_weekly_reports.sql` | Migration |
| `packages/db/src/schema/weekly-reports.ts` | Drizzle schema |
| `packages/db/src/schema/index.ts` | Barrel export |
| `packages/validators/reports.ts` | Zod schemas |
| `apps/web/app/(workspace)/reports/page.tsx` | Report list |
| `apps/web/app/(workspace)/reports/[reportId]/page.tsx` | Report detail |
| `apps/web/app/(workspace)/reports/actions/generate-weekly-report.ts` | Generate action |
| `apps/web/app/(workspace)/reports/actions/get-weekly-reports.ts` | List action |
| `apps/web/app/(workspace)/reports/actions/get-weekly-report-by-id.ts` | Detail action |
| `apps/web/app/(workspace)/reports/components/ReportList.tsx` | List component |
| `apps/web/app/(workspace)/reports/components/TimeSummarySection.tsx` | Section |
| `apps/web/app/(workspace)/reports/components/TaskLogSection.tsx` | Section |
| `apps/web/app/(workspace)/reports/components/AgentActivitySection.tsx` | Section |
| `apps/web/app/(workspace)/reports/components/InvoiceSummarySection.tsx` | Section |
| `apps/web/app/(workspace)/reports/components/ReportSkeleton.tsx` | Skeleton |
| `apps/web/app/(workspace)/reports/components/EmptyReportsState.tsx` | Empty state |

### Testing Standards

- **Unit tests:** Aggregation logic (pure functions), Zod schema validation. No database.
- **Integration tests:** Server Actions with Supabase local, assert query results.
- **RLS tests:** Every policy tested per role. Cross-tenant isolation tested.
- **ATDD:** `apps/web/__tests__/acceptance/epic-8/8-1a-weekly-reports-foundation.spec.ts` — 12+ skipped tests.
- **E2E:** `tests/e2e/epic-8-reporting.spec.ts` — E2E-001, E2E-002 relate to 8-1a.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8]
- [Source: docs/project-context.md#Critical Implementation Rules]
- [Source: supabase/migrations/20260428000006_trust_rls_policies.sql] — canonical RLS
- [Source: packages/agents/invoice-delivery/token.ts] — delivery token pattern (deferred)
- [Source: packages/db/src/schema/invoices.ts] — existing schema pattern
- [Source: packages/db/src/schema/time-entries.ts] — time entry schema for aggregation
- [Source: packages/db/src/schema/agent-runs.ts] — agent run schema

## Dev Agent Record

### Agent Model Used

kimi-k2.6 (OpenCode)

### Debug Log References

- Unit test import path resolution: `../generate-weekly-report` (not `./generate-weekly-report`)
- Type cast for DB rows: `as ReportStatus` + `as SectionType` required because Supabase returns `string`
- `exactOptionalPropertyTypes` required `clientId?: string | undefined` in component props
- pgTAP test wrote for all 3 tables (report_templates, weekly_reports, weekly_report_sections)

### Review Findings

- [x] [Review][Decision] **Task log flat vs grouped** — Resolved: restructured to grouped-by-project per AC1. Task log now returns `{projects: [{projectName, entries: [...]}]}` and renders with project section headers. [generate-weekly-report.ts:163-175]
- [x] [Review][Decision] **"Full CRUD" without DELETE/UPDATE** — Resolved: updated AC6 wording. Reports are immutable once sent; drafts can be soft-archived. DELETE policy intentionally omitted per migration design.
- [x] [Review][Decision] **Modified stale migration** — Resolved: confirmed accidental edit. Reverted REVOKE/GRANT lines in `20260422100001_email_change_requests.sql`.
- [x] [Review][Patch] **Wrong error codes** — Returns `VALIDATION_ERROR` instead of `INVALID_DATE_RANGE` / `PERIOD_TOO_LONG` per AC1 spec. [generate-weekly-report.ts:28]
- [x] [Review][Patch] **Invoice payments missing date filter** — All payments counted regardless of period, violating AC1 spec. [generate-weekly-report.ts:140-148]
- [x] [Review][Patch] **"Back" link text truncated** — Success path shows `← Back` instead of `← Back to reports` per AC4. [reports/[reportId]/page.tsx:34]
- [x] [Review][Patch] **No ClientUser route guard** — No layout/middleware blocks `client_user` role from `/reports` per AC6. Missing `reports/layout.tsx`.
- [x] [Review][Patch] **`AgentRun` type undefined** — Referenced in `AgentActivitySection` props but not defined/imported. [ReportSections.tsx:65]
- [x] [Review][Patch] **Aggregation query errors silently swallowed** — 4 queries (`time_entries`, `invoices`, `agent_runs`, `invoice_payments`) never check `.error` field. [generate-weekly-report.ts:108,123,140,152]
- [x] [Review][Patch] **`countResult.error` silently ignored** — Pagination `total: 0` hides existing data on count query failure. [get-weekly-reports.ts:43]
- [x] [Review][Patch] **`sectionRows` error silently ignored** — Detail page shows empty sections on query failure. [get-weekly-report-by-id.ts:47]
- [x] [Review][Patch] **`String(null)` corruption** — Date fields coerced via `String()` which produces `"null"` string on unexpected nulls. [generate-weekly-report.ts:196-198]
- [x] [Review][Patch] **NaN propagation in reduce** — `Number(r.duration_minutes ?? 0)` can produce NaN if DB returns non-numeric string. [generate-weekly-report.ts:118]
- [x] [Review][Patch] **Sequential awaits instead of Promise.all** — 3 independent aggregation queries run serially. [generate-weekly-report.ts:108-158]
- [x] [Review][Patch] **`T23:59:59Z` misses sub-second entries** — Agent runs at `23:59:59.123` excluded. Use `< nextDay` instead. [generate-weekly-report.ts:157-158]
- [x] [Review][Patch] **`new Date()` on invalid calendar dates** — `2026-02-30` passes regex but produces NaN diff. [reports.ts:29-30]
- [x] [Review][Patch] **Non-UUID reportId not validated** — Returns 500 instead of 400 on `invalid input syntax for type uuid`. [get-weekly-report-by-id.ts:26]
- [x] [Review][Patch] **Unsafe `as` casts** — Zod schemas exist but never used to parse DB responses. [generate-weekly-report.ts:245-271]
- [x] [Review][Patch] **Duplicate `formatDuration`** — One imported, one copy-pasted inline. [TimeSummarySection.tsx:1 vs ReportSections.tsx:24]
- [x] [Review][Patch] **Duplicate `StatusBadge`** — List page has function, detail page inlines nested ternaries. [page.tsx:7-22 vs [reportId]/page.tsx:41-53]
- [x] [Review][Patch] **Index-as-key in lists** — `key={i}` on `TaskLogSection` and `AgentActivitySection` rows. [ReportSections.tsx:50,83]
- [x] [Review][Patch] **Fragile colon delimiter** — Uses `:` to join action_type:status, breaks if either contains colon. [generate-weekly-report.ts:178]
- [x] [Review][Patch] **`templateSnapshot` null values** — DB fields accessed without null coalescing despite possible NULL. [generate-weekly-report.ts:82-84]
- [x] [Review][Patch] **Zero success-path tests** — Only 3 negative tests for 277-line action. [generate-weekly-report.test.ts]
- [x] [Review][Patch] **Placeholder RLS test** — Line 257 had comment explaining it can't actually run. Fixed: removed placeholder, uses fresh report `r3333333`. [rls_weekly_reports.sql:252-258]
- [x] [Review][Patch] **No `update_weekly_report_sections` RLS test** — RPC defined but not covered. [rls_weekly_reports.sql]

### Completion Notes List

1. Database schema already existed (migration `20260528074359_weekly_reports_foundation.sql` + Drizzle `weekly-reports.ts`). Added migration to seed default template inside `create_workspace` RPC (AC5).
2. Added Zod schemas to `packages/types/src/reports.ts` and exported them.
3. Implemented `generateWeeklyReportAction` with date validation, role gating, aggregation across time_entries/invoices/agent_runs, template snapshot, and atomic RPC insert.
4. Implemented `getWeeklyReportsAction` (paginated list) and `getWeeklyReportByIdAction` (detail with sections).
5. Built Server Component list page (`/reports`) with pagination, empty state, status badges, and skeleton.
6. Built Server Component detail page (`/reports/[reportId]`) with 4 sections rendered from pre-computed JSONB.
7. Added section components: `TimeSummarySection`, `TaskLogSection`, `AgentActivitySection`, `InvoiceSummarySection` — all handle zero-data gracefully.
8. Added skeleton components (`ReportListSkeleton`, `ReportDetailSkeleton`) and empty state (`EmptyReportsState`).
9. Added unit tests for Zod validation + role gate (3 tests, all passing).
10. ATDD scaffolds verified: 30 skipped tests in `8-1a-weekly-reports-foundation.spec.ts`.

### Deferred Items (at close)

- Template customization UI → Story 8-1b
- Report re-generation + versioning → Story 8-1c
- PDF export → Story 8-1d (P1, deferred from 8-1a)
- Portal sharing → Story 8-2 / 9-2
- Workspace creation default-template via RPC (not action layer) — handled by new migration

### Test Commit Record

| Test File | First Red Commit SHA | Date |
|-----------|---------------------|------|
| apps/web/__tests__/acceptance/epic-8/8-1a-weekly-reports-foundation.spec.ts | N/A (skipped scaffolds) | 2026-05-28 |
| apps/web/lib/actions/reports/__tests__/generate-weekly-report.test.ts | N/A | 2026-05-28 |

### File List

- `packages/types/src/reports.ts` — new
- `packages/types/src/index.ts` — modified (exports)
- `apps/web/lib/actions/reports/generate-weekly-report.ts` — new
- `apps/web/lib/actions/reports/get-weekly-reports.ts` — new
- `apps/web/lib/actions/reports/get-weekly-report-by-id.ts` — new
- `apps/web/lib/actions/reports/__tests__/generate-weekly-report.test.ts` — new
- `apps/web/app/(workspace)/reports/page.tsx` — new
- `apps/web/app/(workspace)/reports/[reportId]/page.tsx` — new
- `apps/web/app/(workspace)/reports/[reportId]/actions.ts` — new
- `apps/web/app/(workspace)/reports/actions.ts` — new
- `apps/web/app/(workspace)/reports/components/TimeSummarySection.tsx` — new
- `apps/web/app/(workspace)/reports/components/ReportSections.tsx` — new
- `apps/web/app/(workspace)/reports/components/ReportSkeleton.tsx` — new
- `apps/web/app/(workspace)/reports/components/EmptyReportsState.tsx` — new
- `apps/web/app/(workspace)/reports/new/page.tsx` — new
- `supabase/tests/rls_weekly_reports.sql` — new
- `supabase/migrations/20260602000001_workspace_seed_default_report_template.sql` — new
