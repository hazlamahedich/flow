---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-red-phase-scaffolds', 'step-05-data-infrastructure', 'step-06-implementation-checklist']
lastStep: 'step-06-implementation-checklist'
lastSaved: '2026-05-27'
workflowType: 'testarch-atdd'
storyId: '8.3'
storyKey: '8-3-client-health-usage-analytics'
storyFile: '_bmad-output/planning-artifacts/epics.md#Story 8.3'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-3-client-health-usage-analytics.md'
generatedTestFiles:
  - 'apps/web/__tests__/acceptance/epic-8/8-3-client-health-usage-analytics.spec.ts'
  - 'tests/e2e/epic-8-reporting.spec.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/implementation-artifacts/epic-8-kickoff-2026-05-27.md'
  - 'apps/web/vitest.config.ts'
---

# ATDD Checklist - Epic 8, Story 8.3: Client Health Agent & Usage Analytics

**Date:** 2026-05-27
**Author:** team mantis
**Primary Test Level:** API/Acceptance (Vitest) + E2E (Playwright)

---

## Story Summary

As a user, I want a Client Health agent and usage analytics, so that I can proactively manage client relationships and track agent performance.

---

## Acceptance Criteria

1. **AC1:** Client Health agent surfaces health indicators based on engagement, payment, and communication patterns
2. **AC2:** Workspace owners can view usage analytics showing agent task completion rates, approval rates, and trust level distribution (FR100)
3. **AC3:** System tracks validation thesis metrics for product decisions (FR101)

---

## Story Integration Metadata

- **Story ID:** `8.3`
- **Story Key:** `8-3-client-health-usage-analytics`
- **Story File:** `_bmad-output/planning-artifacts/epics.md#Story 8.3`
- **Checklist Path:** `_bmad-output/test-artifacts/atdd-checklist-8-3-client-health-usage-analytics.md`
- **Generated Test Files:**
  - `apps/web/__tests__/acceptance/epic-8/8-3-client-health-usage-analytics.spec.ts`
  - `tests/e2e/epic-8-reporting.spec.ts`

---

## Red-Phase Test Scaffolds Created

### Acceptance Tests (3 ATDD blocks, 8 test cases)

**File:** `apps/web/__tests__/acceptance/epic-8/8-3-client-health-usage-analytics.spec.ts` (~180 lines)

| Test ID | Name | Status | Expected Failure |
|---|---|---|---|
| 8.3-ATDD-001 | Client Health Agent surfaces health indicators | RED | Agent class not defined |
| 8.3-ATDD-002 | Usage analytics dashboard shows completion/approval/trust | RED | Actions not defined |
| 8.3-ATDD-003 | Validation thesis metrics tracking | RED | Actions not defined |

### E2E Tests (2 E2E tests for Story 8.3)

**File:** `tests/e2e/epic-8-reporting.spec.ts`

- ✅ **[8.3-E2E-001]** Analytics dashboard shows metrics and trust distribution — RED (Route not implemented)
- ✅ **[8.3-E2E-002]** Client detail page shows health indicator card — RED (Component not implemented)

---

## Data Factories Created

**File:** `tests/support/factories/health-snapshot.factory.ts` (to be created by dev)

**Exports:**

- `createHealthSnapshot(overrides?)` — Create single health snapshot
- `createHealthSnapshots(count)` — Create array of snapshots

**File:** `tests/support/factories/usage-analytics.factory.ts` (to be created by dev)

**Exports:**

- `createUsageAnalytics(overrides?)` — Create single analytics record
- `createValidationMetric(overrides?)` — Create single validation metric

---

## Fixtures Created

**File:** `tests/support/fixtures/client-health.fixture.ts` (to be created by dev)

**Fixtures:**

- `clientHealth` — Provides a client with health snapshot
  - **Setup:** Creates client, invoices, time entries, agent runs, then generates health snapshot
  - **Provides:** `{ client, snapshot, analytics }`
  - **Cleanup:** Deletes snapshot, analytics, and related seed data

---

## Mock Requirements

### Health Calculation RPC Mock

**Endpoint:** `POST /rest/v1/rpc/calculate_client_health`

**Success Response:**

```json
{
  "engagement_score": 72,
  "payment_score": 95,
  "communication_score": 60,
  "overall_health": "at-risk",
  "indicators": {
    "days_since_last_contact": 5,
    "unpaid_invoice_count": 1,
    "time_entry_streak_days": 3
  }
}
```

---

## Required data-testid Attributes

### Analytics Dashboard (`/analytics`)

- `analytics-heading` — Page heading
- `metric-completion-rate` — Completion rate metric card
- `metric-approval-rate` — Approval rate metric card
- `trust-distribution-chart` — Trust level distribution visualization
- `analytics-date-range` — Date range selector

### Client Detail Page (`/clients/[id]`)

- `client-health-card` — Health indicator card container
- `health-indicator-overall` — Overall health badge
- `health-indicator-engagement` — Engagement score
- `health-indicator-payment` — Payment score
- `health-indicator-communication` — Communication score

---

## Implementation Checklist

### Task 1: Database Migration

**File:** `supabase/migrations/xxx_client_health.sql`

- [ ] Create `client_health_snapshots` table (id, workspace_id, client_id, snapshot_date, engagement_score, payment_score, communication_score, overall_health, indicators JSONB)
- [ ] Create `usage_analytics` table (id, workspace_id, date, agent_completion_rate, agent_approval_rate, trust_level_distribution JSONB, tasks_completed, time_saved_minutes)
- [ ] Create `validation_metrics` table (id, workspace_id, metric_type, value, dimensions JSONB, recorded_at)
- [ ] Add RLS policies with `::text` cast
- [ ] Add indexes on (workspace_id, client_id, snapshot_date)

### Task 2: Client Health Agent

**File:** `packages/agents/client-health/index.ts`

- [ ] Define `ClientHealthAgent` class
- [ ] Implement health scoring algorithm (3 dimensions)
- [ ] Store snapshot in `client_health_snapshots`
- [ ] Run on daily cron (3:00 AM)

### Task 3: Server Actions

**Files:** `apps/web/lib/actions/reports/`

- [ ] `get-client-health.ts` — Fetch latest health snapshot
- [ ] `get-usage-analytics.ts` — Aggregate usage metrics
- [ ] `record-validation-metric.ts` — Store validation metric
- [ ] `get-validation-metrics.ts` — Query time-series metrics

### Task 4: UI Components

**Files:** `apps/web/app/(workspace)/analytics/` and client detail

- [ ] `page.tsx` — Analytics dashboard
- [ ] Metric cards and trust distribution chart
- [ ] Health card on client detail page

### Task 5: E2E Test Activation

- [ ] Remove `test.skip()` from 8.3-E2E-001 and verify RED
- [ ] Remove `test.skip()` from 8.3-E2E-002 and verify RED

---

## Running Tests

```bash
# Run Story 8.3 acceptance tests
pnpm vitest run apps/web/__tests__/acceptance/epic-8/8-3-client-health-usage-analytics.spec.ts

# Run Epic 8 E2E tests for Story 8.3
pnpm exec playwright test tests/e2e/epic-8-reporting.spec.ts --grep "8.3"
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

- ✅ All tests written as red-phase scaffolds
- ✅ Fixtures and factories patterns documented
- ✅ data-testid requirements listed
- ✅ Implementation checklist created

### GREEN Phase (DEV Team - Next Steps)

1. Start with database migration
2. Build ClientHealthAgent scoring algorithm
3. Create server actions for health + analytics
4. Build analytics dashboard UI
5. Activate tests one at a time

### REFACTOR Phase (DEV Team - After All Tests Pass)

1. Review health scoring thresholds
2. Ensure analytics queries are performant
3. Add caching for expensive aggregations

---

## Notes

- Start with 3 hardcoded health dimensions (payment, engagement, communication)
- Tune thresholds before adding more dimensions
- Analytics dashboard should be workspace-owner only
- Validation metrics are internal product analytics, not user-facing

---

**Generated by BMad TEA Agent** — 2026-05-27
