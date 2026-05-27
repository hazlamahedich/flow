---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-red-phase-scaffolds', 'step-05-data-infrastructure', 'step-06-implementation-checklist']
lastStep: 'step-06-implementation-checklist'
lastSaved: '2026-05-27'
workflowType: 'testarch-atdd'
storyId: '8.1'
storyKey: '8-1-weekly-client-reports'
storyFile: '_bmad-output/planning-artifacts/epics.md#Story 8.1'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-1-weekly-client-reports.md'
generatedTestFiles:
  - 'apps/web/__tests__/acceptance/epic-8/8-1-weekly-client-reports.spec.ts'
  - 'tests/e2e/epic-8-reporting.spec.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/implementation-artifacts/epic-8-kickoff-2026-05-27.md'
  - 'playwright.config.ts'
  - 'apps/web/vitest.config.ts'
---

# ATDD Checklist - Epic 8, Story 8.1: Weekly Client Reports

**Date:** 2026-05-27
**Author:** team mantis
**Primary Test Level:** API/Acceptance (Vitest) + E2E (Playwright)

---

## Story Summary

As a user, I want to generate weekly client reports aggregating time, tasks, and agent activity, so that I can review and share client progress.

---

## Acceptance Criteria

1. **AC1:** Report generation RPC — given a client_id + date range, returns aggregated time, tasks, and agent activity data
2. **AC2:** Report persistence — stores report header + sections in `weekly_reports` / `weekly_report_sections`
3. **AC3:** Report list UI — user sees list of generated reports per client
4. **AC4:** Report detail view — user sees formatted report with time summary, task log, agent activity
5. **AC5:** Report templates — user can customize sections (enable/disable) per client
6. **AC6:** Report re-generation — user can re-run report for a period if data changed

---

## Story Integration Metadata

- **Story ID:** `8.1`
- **Story Key:** `8-1-weekly-client-reports`
- **Story File:** `_bmad-output/planning-artifacts/epics.md#Story 8.1`
- **Checklist Path:** `_bmad-output/test-artifacts/atdd-checklist-8-1-weekly-client-reports.md`
- **Generated Test Files:**
  - `apps/web/__tests__/acceptance/epic-8/8-1-weekly-client-reports.spec.ts` (API/Acceptance)
  - `tests/e2e/epic-8-reporting.spec.ts` (E2E)

---

## Red-Phase Test Scaffolds Created

### Acceptance Tests (6 ATDD blocks, 12 test cases)

**File:** `apps/web/__tests__/acceptance/epic-8/8-1-weekly-client-reports.spec.ts` (~200 lines)

| Test ID | Name | Status | Expected Failure |
|---|---|---|---|
| 8.1-ATDD-001 | generateWeeklyReport RPC aggregates data | RED | Action not defined |
| 8.1-ATDD-002 | Report persistence stores header + sections | RED | Tables not created |
| 8.1-ATDD-003 | Report list page shows reports per client | RED | Page/component not defined |
| 8.1-ATDD-004 | Report detail view shows formatted sections | RED | Page/component not defined |
| 8.1-ATDD-005 | Report templates allow customizable sections | RED | Schema/action not defined |
| 8.1-ATDD-006 | Report re-generation updates existing report | RED | Action not defined |

### E2E Tests (4 E2E tests for Story 8.1)

**File:** `tests/e2e/epic-8-reporting.spec.ts`

- ✅ **[8.1-E2E-001]** Reports list page loads with heading and generate button — RED (Route not implemented)
- ✅ **[8.1-E2E-002]** Generate report form has client picker and date range — RED (Form not implemented)
- ✅ **[8.1-E2E-003]** Report detail page shows time summary, task log, agent activity — RED (Route not implemented)
- ✅ **[8.1-E2E-004]** Report template settings shows section toggles and branding — RED (Route not implemented)

---

## Data Factories Created

**File:** `tests/support/factories/weekly-report.factory.ts` (to be created by dev)

**Exports:**

- `createWeeklyReport(overrides?)` — Create single report with optional overrides
- `createWeeklyReports(count)` — Create array of reports
- `createReportSection(overrides?)` — Create single section
- `createReportTemplate(overrides?)` — Create single template

---

## Fixtures Created

**File:** `tests/support/fixtures/reporting.fixture.ts` (to be created by dev)

**Fixtures:**

- `weeklyReport` — Provides a generated weekly report with sections
  - **Setup:** Creates client, time entries, invoice line items, then generates report
  - **Provides:** `{ report, sections, client }`
  - **Cleanup:** Deletes report, sections, and related seed data

---

## Mock Requirements

### Supabase RPC Mock

**Endpoint:** `POST /rest/v1/rpc/generate_weekly_report`

**Success Response:**

```json
{
  "report": { "id": "rpt-1", "status": "draft", ... },
  "sections": [
    { "section_type": "time_summary", "content": { ... } },
    { "section_type": "task_log", "content": { ... } },
    { "section_type": "agent_activity", "content": { ... } }
  ]
}
```

**Failure Response:**

```json
{ "error": { "code": "INVALID_DATE_RANGE", "message": "..." } }
```

---

## Required data-testid Attributes

### Reports List Page (`/reports`)

- `reports-list-heading` — Page heading
- `generate-report-button` — CTA to generate new report
- `report-card-{id}` — Individual report card
- `report-status-badge` — Status indicator on report card

### Generate Report Form (`/reports/generate`)

- `client-picker` — Client selection dropdown
- `period-start-date` — Date picker for period start
- `period-end-date` — Date picker for period end
- `generate-submit-button` — Submit button

### Report Detail Page (`/reports/[reportId]`)

- `report-detail-heading` — Report title/heading
- `section-time-summary` — Time summary section container
- `section-task-log` — Task log section container
- `section-agent-activity` — Agent activity section container
- `regenerate-report-button` — Re-generation CTA

### Report Templates Page (`/reports/templates`)

- `template-section-toggle` — Section enable/disable toggles
- `template-branding-color` — Accent color picker
- `template-save-button` — Save template button

---

## Implementation Checklist

### Task 1: Database Migration

**File:** `supabase/migrations/xxx_weekly_reports.sql`

- [ ] Create `weekly_reports` table (id, workspace_id, client_id, period_start, period_end, status, template_id, generated_at, sent_at)
- [ ] Create `weekly_report_sections` table (id, report_id, section_type, title, content JSONB, sort_order)
- [ ] Create `report_templates` table (id, workspace_id, client_id, name, sections_config JSONB, branding JSONB)
- [ ] Add RLS policies (workspace_id matches JWT claim with `::text` cast)
- [ ] Add foreign keys and indexes

### Task 2: Server Actions

**Files:** `apps/web/lib/actions/reports/`

- [ ] `generate-weekly-report.ts` — RPC wrapper for report generation
- [ ] `get-weekly-reports.ts` — List reports per client
- [ ] `get-weekly-report-by-id.ts` — Fetch report + sections
- [ ] `save-report-template.ts` — Create/update template
- [ ] `regenerate-weekly-report.ts` — Re-run aggregation for existing report

### Task 3: UI Components

**Files:** `apps/web/app/(workspace)/reports/`

- [ ] `page.tsx` — Reports list page
- [ ] `generate/page.tsx` — Generate report form
- [ ] `[reportId]/page.tsx` — Report detail view
- [ ] `templates/page.tsx` — Template settings

### Task 4: E2E Test Activation

- [ ] Remove `test.skip()` from 8.1-E2E-001 and verify RED
- [ ] Remove `test.skip()` from 8.1-E2E-002 and verify RED
- [ ] Remove `test.skip()` from 8.1-E2E-003 and verify RED
- [ ] Remove `test.skip()` from 8.1-E2E-004 and verify RED

### Task 5: Acceptance Test Activation

- [ ] Remove `test.skip()` from ATDD blocks and verify RED

---

## Running Tests

```bash
# Run all Epic 8 acceptance tests
pnpm vitest run apps/web/__tests__/acceptance/epic-8/8-1-weekly-client-reports.spec.ts

# Run all Epic 8 E2E tests
pnpm exec playwright test tests/e2e/epic-8-reporting.spec.ts

# Run specific E2E test in headed mode
pnpm exec playwright test tests/e2e/epic-8-reporting.spec.ts --grep "8.1-E2E-001" --headed

# Debug specific test
pnpm exec playwright test tests/e2e/epic-8-reporting.spec.ts --grep "8.1-E2E-001" --debug
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

- ✅ All tests written as red-phase scaffolds
- ✅ Fixtures and factories patterns documented
- ✅ Mock requirements documented
- ✅ data-testid requirements listed
- ✅ Implementation checklist created

### GREEN Phase (DEV Team - Next Steps)

1. Pick one scaffolded test from implementation checklist (start with database migration)
2. Remove `test.skip()` for that test and confirm it fails first
3. Read the test to understand expected behavior
4. Implement minimal code to make that specific test pass
5. Run the test to verify it now passes (green)
6. Check off the task in implementation checklist
7. Move to next test and repeat

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Verify all tests pass (green phase complete)
2. Review code for quality (readability, maintainability, performance)
3. Extract duplications (DRY principle)
4. Optimize performance if needed
5. Ensure tests still pass after each refactor

---

## Next Steps

1. Link this checklist into story file `Dev Notes` / `ATDD Artifacts`
2. Begin implementation using checklist as guide
3. Activate one scaffold at a time by removing `test.skip()`
4. Work one activated test at a time (red → green for each)
5. When all tests pass, refactor code for quality
6. Update story status to `done` in sprint-status.yaml

---

## Knowledge Base References Applied

- **fixture-architecture.md** — Test fixture patterns with setup/teardown
- **data-factories.md** — Factory patterns using `@faker-js/faker`
- **network-first.md** — Route interception patterns
- **test-quality.md** — Test design principles (Given-When-Then, atomic tests)
- **test-levels-framework.md** — Test level selection (API + E2E)

---

## Notes

- Report queries must be pre-computed at generation time; no live aggregation on view
- Template schema uses JSONB for flexible section configuration
- PDF export spike needed in Sprint 0
- Portal sharing reuses delivery token pattern from Epic 7

---

**Generated by BMad TEA Agent** — 2026-05-27
