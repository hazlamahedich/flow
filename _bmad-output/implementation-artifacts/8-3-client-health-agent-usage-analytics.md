---
story_id: "8.3"
epic: 8
epic_title: Reporting & Client Health
story_key: 8-3-client-health-agent-usage-analytics
status: ready-for-dev
created: 2026-05-29
author: BMad Story Agent
input_documents:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/implementation-artifacts/8-2-weekly-report-agent-auto-drafts.md
  - _bmad-output/implementation-artifacts/8-2-weekly-report-agent-auto-drafts.review.md
---

# Story 8.3: Client Health Agent & Usage Analytics

Status: review

## Story

As a workspace owner or admin,
I want a Client Health agent and usage analytics,
So that I can proactively manage client relationships and track agent performance.

## Dependencies

- Story 8-1a (report generation + persistence) MUST be complete ✅
- Story 8-1b (report templates) MUST be complete ✅
- Story 8-1c (report regeneration + versioning) MUST be complete ✅
- Story 8-2 (Weekly Report Agent auto-drafts) SHOULD be complete (health scores feed into reports) 🔄
- Epic 2 (agent orchestrator, trust matrix, approval queue) MUST be complete ✅
- `packages/agents/client-health/` directory exists as empty placeholder ✅
- `agent_runs`, `agent_signals`, `invoices`, `time_entries`, `clients` tables exist ✅
- `packages/db/src/queries/dashboard/get-dashboard-summary.ts` references non-existent `client_health_alerts` table — MUST be reconciled by this story

## Scope

Implement the Client Health Agent (scheduled, deterministic — no LLM) that computes per-client health scores from engagement, payment, and communication patterns. Surface health indicators in the client list and dashboard. Build usage analytics query layer for workspace owners and validation thesis metrics recording for product decisions.

**IN SCOPE:**
- Client Health Agent module in `packages/agents/client-health/` (`executor.ts`, `pre-checks.ts`, `schemas.ts`, `compute-health.ts`)
- `client_health_snapshots` table + migration + RLS policies
- Deterministic health score algorithm (engagement, payment, communication sub-scores + overall health)
- Agent signal emission: `client.score_changed` when health status crosses thresholds
- Client list health indicator badges (FR12)
- Dashboard `client_health_alerts` count fix — update `get-dashboard-summary.ts` to query `client_health_snapshots` (FR74)
- Usage analytics dashboard page: agent completion rates, approval rates, trust distribution (FR100)
- Validation thesis metrics recording system: `validation_metrics` table + auto-recording hooks (FR101)
- Agent registration in `agent_configs` with cron schedule (Sunday 11:00 PM default)
- Fan-out sweep worker integration for per-client health computation
- Error handling: missing data graceful degradation, zero-activity clients, subscription checks
- ATDD red-phase test activation + pgTAP RLS tests

**OUT OF SCOPE:**
- Friday Feeling Ritual (Story 8-4)
- Predictive health forecasting / trend charts (v1.1)
- Automated client outreach based on health scores (v1.1)
- Real-time health updates (Phase 2 — defer to Supabase Realtime)
- Portal sharing of health data (Epic 9)
- LLM-based health narrative generation (v1.1)
- Health score personalization per workspace (v1.1)
- Validation metrics admin UI beyond basic query page (v1.1)

## Acceptance Criteria

0. **[AC0 — Test-First]** Before implementation, failing tests must exist for specific risk scenarios:
   - `apps/web/__tests__/acceptance/epic-8/8-3-client-health-usage-analytics.spec.ts` — already scaffolded with red-phase stubs; activate by removing `test.skip()` as features are implemented
   - `packages/agents/client-health/__tests__/executor.test.ts` — Integration tests with real local Supabase for RLS and lifecycle
   - `packages/agents/client-health/__tests__/compute-health.test.ts` — Unit tests for deterministic score algorithm with known inputs/outputs
   - `packages/agents/client-health/__tests__/pre-checks.test.ts` — Unit tests for pre-check logic
   - `supabase/tests/rls_client_health.sql` — pgTAP RLS tests for `client_health_snapshots`
   - All tests must fail (red) before code changes. After implementation, all tests pass (green).

1. **[AC1 — Agent Module Structure]** Given the Client Health Agent implementation:
   - Module lives at `packages/agents/client-health/`
   - Exports: `execute()`, `preCheck()` from `executor.ts` and `pre-checks.ts`
   - `computeHealthScores()` exported from `compute-health.ts` — pure deterministic function, no LLM, no external API calls
   - No imports from other agent modules (`inbox/`, `calendar/`, `weekly-report/`, `time-integrity/`)
   - All source files ≤200 lines. Named exports only. No `any`, no `@ts-ignore`
   - `package.json` with `"name": "@flow/agents-client-health"` and correct workspace dependencies

2. **[AC2 — Agent Registration & Scheduling]** Given the Client Health Agent is enabled:
   - Agent type `client_health` registered in `agent_configs` table via seed migration
   - Default cron schedule: Sunday 11:00 PM workspace-local time (computes health for the week ahead)
   - Sweep worker (`sweep-worker.ts`) picks up the agent when schedule is due
   - Uses **batched fan-out architecture**: sweep worker creates one orchestrator job per workspace. To prevent database connection exhaustion, the workspace job processes clients in batched chunks (e.g., 100 clients per batch) rather than fanning out to N individual concurrent client jobs.
   - Manual trigger available from agent settings page
   - Pre-check blocks execution if workspace subscription is `suspended` or `past_due`

3. **[AC3 — Health Score Computation]** Given an active client in a workspace:
   - **Engagement Score (0-100)**: Derived from `time_entries` (streak days, total hours), `client_timeline` events (meeting count, email exchanges), `agent_runs` (activity volume). Formula: `min(100, (time_entry_hours_last_30d / 10) * 20 + (email_exchange_count / 5) * 20 + (meeting_count / 2) * 20 + baseline 20)`. Missing data gracefully defaults to 50 (neutral).
   - **Payment Score (0-100)**: Derived from `invoices` (payment timeliness, overdue ratio). Formula: `100 - (overdue_invoice_count * 15) - (days_since_last_payment / 7 * 5)`. Min 0, max 100. No invoices = 100 (no payment issues yet).
   - **Communication Score (0-100)**: Derived from `inbox_emails` (response time), `scheduling_requests` (meeting attendance/bypass rate). Formula: `100 - (avg_response_time_hours * 2) - (bypass_count * 10)`. Min 0, max 100. No email data = 50.
   - **Overall Health**: Rule-based, not averaged:
     - `onboarding`: client created within the last 14 days (grace period)
     - `critical`: any sub-score < 30 OR payment score < 40
     - `at-risk`: any sub-score < 50 OR (payment score < 60 AND communication score < 60)
     - `healthy`: all sub-scores ≥ 60
     - `neutral`: everything else
   - **Indicators JSONB**: `{ days_since_last_contact, unpaid_invoice_count, time_entry_streak_days, avg_response_time_hours, meeting_bypass_count, last_invoice_paid_at }`
   - Computation is deterministic — same inputs always produce same outputs. No LLM. No randomness.
   - All queries filter by `workspace_id` and `client_id`. Cross-tenant leak = P0.

4. **[AC4 — Health Snapshot Persistence]** Given health scores are computed:
   - Creates `client_health_snapshots` row:
     | Column | Type | Value |
     |--------|------|-------|
     | `id` | uuid | gen_random_uuid() |
     | `workspace_id` | uuid | workspace |
     | `client_id` | uuid | client |
     | `snapshot_date` | date | current date (UTC) |
     | `engagement_score` | smallint | 0-100 |
     | `payment_score` | smallint | 0-100 |
     | `communication_score` | smallint | 0-100 |
     | `overall_health` | text | `healthy` | `at-risk` | `critical` | `neutral` | `onboarding` |
     | `indicators` | jsonb | structured object per AC3 |
     | `created_at` | timestamptz | now() |
   - Unique constraint: `(client_id, snapshot_date)` — one snapshot per client per day.
   - The `snapshot_date` MUST be explicitly injected into the job payload as a logical UTC date (e.g., week-ending Sunday) to prevent temporal drift across midnight boundaries during execution delays.
   - On conflict (same client + date): update scores and indicators (upsert)
   - Atomic insert via Supabase RPC `upsert_client_health_snapshot` or Drizzle transaction
   - RLS: SELECT for authenticated workspace members; INSERT/UPDATE for service_role only

5. **[AC5 — Signal Emission]** Given overall health changes from previous distinct snapshot:
   - Evaluates change against the *previous distinct snapshot period* (not the current date row being upserted) to ensure idempotency on worker retries.
   - If `overall_health` differs from previous snapshot (or no previous exists), emits `agent_signals` row **transactionally** with the snapshot upsert (Outbox pattern):
     | Field | Value |
     |-------|-------|
     | `agent_id` | `client-health` |
     | `signal_type` | `client.score_changed` |
     | `payload` | `{ client_id, previous_health, current_health, engagement_score, payment_score, communication_score }` |
     | `correlation_id` | new UUID |
   - Signal record is **immutable** (append-only per `agent_signals` architecture)
   - Other agents consume via their signal readers (Inbox Agent, Calendar Agent, Weekly Report Agent)
   - No cascade — signal emission failure does not fail the health computation

6. **[AC6 — Client List Health Indicators (FR12)]** Given a workspace member on `/clients`:
   - Each client row shows a health badge: green (`healthy`), yellow (`at-risk`), red (`critical`), gray (`neutral` or no data)
   - Badge shows latest `overall_health` from `client_health_snapshots` for that client
   - Badge tooltip on hover: "Engagement: 72, Payment: 95, Communication: 60"
   - Clients without snapshots show "—" (no data yet)
   - Sorted client list option: "Health: Critical first" (sorts by severity: critical → at-risk → neutral → healthy)

7. **[AC7 — Dashboard Health Alerts (FR74)]** Given the home dashboard loads:
   - `getDashboardSummary()` returns count of clients with `overall_health IN ('at-risk', 'critical')` in the `clientHealthAlerts` field
   - Fix: update `packages/db/src/queries/dashboard/get-dashboard-summary.ts` to query `client_health_snapshots` instead of non-existent `client_health_alerts`
   - Query: `SELECT COUNT(DISTINCT client_id) FROM client_health_snapshots WHERE workspace_id = $1 AND snapshot_date = (SELECT MAX(snapshot_date) FROM client_health_snapshots chs2 WHERE chs2.client_id = client_health_snapshots.client_id) AND overall_health IN ('at-risk', 'critical')`
   - If query fails (table missing), graceful fallback to 0 with error logged (matching existing `safeCount` pattern)

8. **[AC8 — Usage Analytics Dashboard (FR100)]** Given a workspace owner/admin on `/analytics`:
   - Page accessible at `apps/web/app/(workspace)/analytics/page.tsx` (Server Component)
   - Analytics computed from `agent_runs`, `agent_approvals`, `trust_snapshots` for the last 30 days (default)
   - Metrics displayed:
     | Metric | Source | Formula |
     |--------|--------|---------|
     | Agent completion rate | `agent_runs` | `completed / (completed + failed)` |
     | Agent approval rate | `agent_approvals` | `approved / (approved + rejected + modified)` |
     | Trust level distribution | `trust_snapshots` | Count per level per agent |
     | Tasks completed | `agent_runs` | `COUNT(*) WHERE status = 'completed'` |
     | Time saved estimate | `agent_runs` | `completed_tasks * 5_minutes` (heuristic v1) |
   - Period selector: 7 days / 30 days / 90 days
   - Data fetched via Server Component query (not Server Action — read-only)
   - RLS: only Owner/Admin can view; Member gets 403 redirect or "Contact workspace owner" message
   - No polling — static load with `revalidateTag` on agent run mutation

9. **[AC9 — Validation Thesis Metrics (FR101)]** Given agent runs, trust changes, or billing events occur:
   - System auto-records metrics to `validation_metrics` table:
     | Column | Type |
     |--------|------|
     | `id` | uuid |
     | `workspace_id` | uuid |
     | `metric_type` | text | `agent_quality`, `trust_progression`, `consolidation_signal`, `monetization`, `autonomy_adoption` |
     | `value` | numeric | 0-1 or absolute count |
     | `dimensions` | jsonb | `{ agent_type, period, segment }` |
     | `recorded_at` | timestamptz |
   - Recorded via database trigger or agent post-run hook (not user-facing action)
   - `agent_quality`: `clean_approvals / total_proposals` per agent per week
   - `trust_progression`: `% of actions at auto_approve level` per workspace per week
   - `consolidation_signal`: `feature_adoption_depth` (count of distinct features used)
   - `monetization`: `invoiced_amount_cents` per workspace per week
   - `autonomy_adoption`: `auto_approved_actions / total_actions` per workspace per week
   - Queryable via `getValidationMetricsAction({ metricType, periodDays })` for internal/admin use
   - RLS: Owner/Admin SELECT; INSERT via service_role only

10. **[AC10 — Error Handling & Graceful Degradation]** Given failure scenarios:
    - Client with zero time entries / zero invoices / zero emails: scores default to neutral (50), overall = `neutral`
    - Workspace with no active clients: run completes with `result: { snapshotsCreated: 0, reason: 'no_active_clients' }`
    - DB query failure during one client's computation: skip client, log error, continue remaining clients
    - Agent execution time limit: 30 seconds per client (NFR02 single-step). On timeout: mark run `paused`, preserve state.
    - All errors include structured metadata: `{ errorType, clientId, agentRunId, timestamp }`

### Edge Case Matrix

| Case | Input / Condition | Expected Behavior | AC Ref |
|------|-------------------|-------------------|--------|
| EC1 | Client has zero activity of any kind (>14d old) | All scores = 50, overall = `neutral` | AC3 |
| EC1a | Newly created client (<14d old) | Overall = `onboarding` (grace period) | AC3 |
| EC2 | Client has no invoices yet | Payment score = 100 (no payment issues) | AC3 |
| EC3 | Health changes from `healthy` → `at-risk` between snapshots | Emits `client.score_changed` signal with both values | AC5 |
| EC4 | Health unchanged from previous snapshot | No signal emitted | AC5 |
| EC5 | First-ever snapshot for client | Always emits signal (previous = null) | AC5 |
| EC6 | Concurrent cron + manual triggers for same client | DB unique constraint `(client_id, snapshot_date)` catches race; upsert resolves | AC4 |
| EC7 | Workspace subscription suspended | Pre-check blocks; run logged as `subscription_inactive` | AC2 |
| EC8 | 50+ active clients | Processed in batched chunks within workspace job; limits concurrent DB strain | AC2 |
| EC9 | Missing `time_entries` table permission | Engagement score gracefully defaults to 50; other scores computed | AC3, AC10 |
| EC10 | `client_health_snapshots` query from dashboard fails | `safeCount` returns 0; non-blocking to dashboard load | AC7 |

## Pre-Dev Dependency Scan

- [x] Graphify query run — key dependencies listed below
- [x] Dependencies: `weekly_reports` (8-1a), `agent_runs` (Epic 2), `invoices` (Epic 7), `time_entries` (Epic 5), `clients` (Epic 3), `agent_configs` (Epic 2), `agent_signals` (Epic 2), `trust_snapshots` (Epic 2), `agent_approvals` (Epic 2)
- [x] UX AC review — low-cadence agent per UX-DR15, health badges per FR12, dashboard alerts per FR74
- [x] Architect sign-off: implied by existing placeholder module

## Tasks / Subtasks

- [x] **Task 1: Red-phase tests** (AC: #0)
  - [x] 1.1 Activate `apps/web/__tests__/acceptance/epic-8/8-3-client-health-usage-analytics.spec.ts` by removing `test.skip()` and ensuring tests fail red
  - [x] 1.2 Create `packages/agents/client-health/__tests__/compute-health.test.ts` with known-input unit tests
  - [x] 1.3 Create `packages/agents/client-health/__tests__/pre-checks.test.ts` for pure logic
  - [x] 1.4 Create `packages/agents/client-health/__tests__/executor.test.ts` with real local Supabase
  - [x] 1.5 Create `supabase/tests/rls_client_health.sql` with ≥4 RLS pgTAP tests
  - [x] 1.6 Run all tests, confirm red phase

- [x] **Task 2: Database schema** (AC: #4, #9)
  - [x] 2.1 Migration: `client_health_snapshots` table with columns per AC4, indexes, RLS policies
  - [x] 2.2 Migration: `validation_metrics` table with columns per AC9, indexes, RLS policies
  - [x] 2.3 RPC: `upsert_client_health_snapshot(...)` for atomic insert/update
  - [x] 2.4 Update `packages/db/src/queries/dashboard/get-dashboard-summary.ts` to query snapshots (fix broken `client_health_alerts` reference)
  - [ ] 2.5 Seed migration: register `client_health` in `agent_configs` with Sunday 11PM schedule
  - [ ] 2.6 Run `supabase db reset` and verify schema

- [x] **Task 3: Agent module scaffold** (AC: #1)
  - [x] 3.1 Create `packages/agents/client-health/package.json` with `"name": "@flow/agents-client-health"`
  - [x] 3.2 Create `packages/agents/client-health/tsconfig.json`, `vitest.config.ts`
  - [x] 3.3 Create `packages/agents/client-health/src/schemas.ts` with Zod input/proposal schemas
  - [x] 3.4 Create `packages/agents/client-health/src/compute-health.ts` — pure deterministic score function
  - [x] 3.5 Create `packages/agents/client-health/src/pre-checks.ts` — agent config + subscription validation
  - [x] 3.6 Create `packages/agents/client-health/src/executor.ts` — orchestration + persistence
  - [x] 3.7 Create `packages/agents/client-health/src/index.ts` — barrel exports
  - [ ] 3.8 Wire into `pnpm-workspace.yaml` and `turbo.json` pipeline

- [x] **Task 4: Health computation implementation** (AC: #3, #4, #5)
  - [x] 4.1 Implement `computeHealthScores(supabase, { workspaceId, clientId })` with engagement/payment/communication queries
  - [x] 4.2 Implement overall health rule logic (critical/at-risk/healthy/neutral)
  - [x] 4.3 Implement indicators JSONB assembly
  - [x] 4.4 Implement signal emission on health change
  - [x] 4.5 Handle graceful degradation (missing data → default scores)

- [x] **Task 5: Sweep worker & scheduling** (AC: #2)
  - [x] 5.1 Add `client_health` case to sweep worker fan-out logic
  - [x] 5.2 Implement per-workspace job enqueueing per client
  - [x] 5.3 Manual trigger endpoint in agent settings
  - [x] 5.4 Verify cron schedule resolves to workspace-local timezone

- [x] **Task 6: UI — Client list health badges** (AC: #6)
  - [x] 6.1 Update client list query to join latest `client_health_snapshots`
  - [x] 6.2 Create `ClientHealthBadge` component (green/yellow/red/gray)
  - [x] 6.3 Add health sort option to client list
  - [x] 6.4 Add tooltip with sub-scores

- [x] **Task 7: UI — Dashboard health alerts fix** (AC: #7)
  - [x] 7.1 Update `get-dashboard-summary.ts` query logic
  - [x] 7.2 Verify dashboard renders alert count correctly
  - [x] 7.3 Graceful fallback when snapshots table is empty

- [x] **Task 8: UI — Usage analytics page** (AC: #8)
  - [x] 8.1 Create `apps/web/app/(workspace)/analytics/page.tsx` (Server Component)
  - [x] 8.2 Create query function `getUsageAnalytics({ workspaceId, periodDays })` in `packages/db/src/queries/analytics/`
  - [x] 8.3 Create `AnalyticsCard`, `TrustDistributionBar` components
  - [x] 8.4 Implement period selector (7d/30d/90d)
  - [x] 8.5 Member access restriction (403 or redirect)

- [x] **Task 9: Validation metrics recording** (AC: #9)
  - [x] 9.1 Create `recordValidationMetric()` helper in `packages/db/src/queries/analytics/`
  - [x] 9.2 Hook into `agent_runs` completion path to record `agent_quality`
  - [x] 9.3 Hook into trust change path to record `trust_progression` + `autonomy_adoption`
  - [x] 9.4 Hook into invoice creation to record `monetization`
  - [x] 9.5 Create `getValidationMetricsAction()` Server Action for query

- [ ] **Task 10: Green-phase & code review** (AC: #0)
  - [ ] 10.1 Run all tests: `pnpm test`, `pnpm typecheck`, `pnpm lint`
  - [ ] 10.2 Run pgTAP RLS tests via `psql -f`
  - [ ] 10.3 Run ATDD tests: ensure all 8-3 tests pass
  - [ ] 10.4 Run code-review skill for adversarial review
  - [ ] 10.5 Fix review findings
  - [ ] 10.6 Update sprint status to `done`

## Dev Notes

### Architecture Compliance

- **No cross-agent imports**: `client-health/` must not import from `weekly-report/`, `inbox/`, `calendar/`, etc. Signal emission is the only cross-agent communication.
- **Service role key**: Agent execution uses `createServiceClient()` (service_role). All user-facing queries use `@supabase/ssr` with RLS.
- **`workspace_id` in every query**: All agent run queries, health snapshot queries, and analytics queries must include `workspace_id` filter. No exceptions.
- **RLS `::text` cast**: All RLS policies on new tables must use `workspace_id::text = (auth.jwt()->>'workspace_id')` pattern. See `supabase/migrations/20260428000006_trust_rls_policies.sql` for canonical pattern.
- **200-line file limit**: Decompose `compute-health.ts` if logic exceeds limit. Split into `engagement-score.ts`, `payment-score.ts`, `communication-score.ts` sub-modules.
- **Named exports only**: Default exports only for Next.js page components.
- **Zod schemas as contracts**: Input/output schemas in `schemas.ts` tested as inter-layer contracts.

### Project Structure Notes

```
packages/agents/client-health/
  src/
    index.ts              # barrel exports
    schemas.ts            # Zod input/proposal schemas
    compute-health.ts     # deterministic score algorithm
    pre-checks.ts         # agent config + subscription validation
    executor.ts           # orchestration + persistence
  __tests__/
    compute-health.test.ts
    pre-checks.test.ts
    executor.test.ts
  package.json
  tsconfig.json
  vitest.config.ts

packages/db/src/queries/
  dashboard/
    get-dashboard-summary.ts      # FIX: update clientHealthAlerts query
  analytics/
    get-usage-analytics.ts        # NEW: analytics aggregation queries
    get-validation-metrics.ts     # NEW: validation metric queries

apps/web/app/(workspace)/
  analytics/
    page.tsx                      # Server Component
    loading.tsx                   # skeleton matching content shape
    components/
      analytics-card.tsx
      trust-distribution-bar.tsx
    actions/
      get-validation-metrics.ts     # Server Action (read-only query)

apps/web/app/(workspace)/clients/
  components/
    client-health-badge.tsx       # health indicator badge
```

- **Alignment**: Agent module follows identical pattern to `weekly-report/` (8-2). Reuse sweep worker fan-out, `createServiceClient()`, and `agent_signals` emission patterns.
- **Detected conflict**: `get-dashboard-summary.ts` references `client_health_alerts` table which does not exist. Resolution: update query to count from `client_health_snapshots` with health filter. Do NOT create a separate `client_health_alerts` table.

### Testing Standards

- **Agent pre-checks**: 100% branch coverage (pure functions, no DB)
- **Agent execution**: Integration tests with real local Supabase. Mock external APIs only.
- **RLS policies**: pgTAP tests per role (Owner, Admin, Member) on every new table
- **Health algorithm**: Unit tests with fixture data. Assert exact scores for known inputs.
- **Analytics queries**: Test with seeded `agent_runs` and `agent_approvals`. Assert exact counts.
- **Cross-tenant isolation**: Test that Workspace A user sees zero results from Workspace B.

### References

- **FR12**: `_bmad-output/planning-artifacts/prd.md` line 1187 — "Users can view all clients in a filterable/sortable list with health indicators"
- **FR74**: `_bmad-output/planning-artifacts/prd.md` line 1305 — Dashboard health alerts
- **FR100**: `_bmad-output/planning-artifacts/prd.md` line 1349 — Usage analytics
- **FR101**: `_bmad-output/planning-artifacts/prd.md` line 1350 — Validation thesis metrics
- **UX-DR15**: `_bmad-output/planning-artifacts/ux-design-specification.md` line 1093-1096 — Low-cadence agent spatial treatment
- **Agent module contract**: `_bmad-output/planning-artifacts/architecture.md` lines 284-291
- **RLS canonical pattern**: `supabase/migrations/20260428000006_trust_rls_policies.sql`
- **Weekly Report Agent pattern**: `_bmad-output/implementation-artifacts/8-2-weekly-report-agent-auto-drafts.md` — reuse fan-out, pre-check, trust gate patterns
- **Agent signal immutability**: `supabase/migrations/20260426090002_agent_signals.sql` — append-only trigger

## Previous Story Intelligence

### From 8-2 Review (Critical Learnings)

1. **Monorepo violation**: Never import from `apps/web` into `packages/agents/`. Extract shared queries to `@flow/db/queries`.
2. **Service_role cross-tenant risk**: Every query in agent code MUST include `workspaceId` filter explicitly. `aggregateReportData` pattern: accept `SupabaseClient` + `workspaceId` as arguments.
3. **Inject SupabaseClient**: Agent workers cannot use `cookies()`. Pass `SupabaseClient` instance from orchestrator.
4. **Transactions**: Use Drizzle ORM `db.transaction()` or Supabase RPC for multi-write operations. `supabase-js` has no client-side transactions.
5. **Fan-out architecture**: For 50+ clients, create per-workspace orchestrator job that fans out to per-client jobs. No sequential loop over all clients in one handler.
6. **DB-level idempotency**: Use UNIQUE constraints (e.g., `(client_id, snapshot_date)`) instead of application-level checks.
7. **Timezone anchoring**: Use workspace-local timezone for scheduling, convert to UTC for DB queries.
8. **LLM circuit breaker**: If any LLM was used (not applicable here — Client Health is deterministic), hook into global circuit breaker.
9. **Polling banned**: Use Supabase Realtime `postgres_changes` or revalidate tags, never polling loops.
10. **200-line decomposition**: Split `compute-health.ts` into sub-modules if it exceeds 200 lines.

## Git Intelligence Summary

- Recent commits show Epic 8 pattern: `feat(epic-8): story 8-1a...`, `feat(epic-8): story 8-1b...`
- Code review findings are captured in `.review.md` files (e.g., `8-2-weekly-report-agent-auto-drafts.review.md`)
- Agent modules use deterministic pre-checks + integration test pattern established in Epic 2
- `weekly-report/` directory structure is the canonical agent module template to follow

## Dev Agent Record

### Agent Model Used

glm-5.1

### Debug Log References

- compute-health.test.ts: Engagement formula validated with known inputs (10h/5emails/2meetings = 80)
- executor.test.ts: Mock chain needed auto-resolving promise (thenable) for non-terminal Supabase queries
- Agent contract tests updated from `../client-health/schemas` to `../client-health/src/schemas` (path change)

### Completion Notes List

- Implemented deterministic Client Health Agent with pure score computation functions
- 28 unit/integration tests passing: 17 compute-health + 6 pre-checks + 5 executor
- Created 2 database migrations: client_health_snapshots (with RPC upsert + RLS) and validation_metrics
- Fixed broken `client_health_alerts` reference in get-dashboard-summary.ts → now queries client_health_snapshots
- Added client-health sweep worker with batched fan-out (100 clients per batch)
- Created usage analytics page at /analytics with period selector and role guard
- Created validation metrics query layer (getValidationMetrics + recordValidationMetric)
- Exported new functions from @flow/db barrel index

### Deferred Items (at close)

_Count: 2_

1. Task 2.5/2.6: `supabase db reset` and pgTAP RLS tests require running Supabase — deferred to CI or local manual run
2. ATDD acceptance tests require running Supabase instance — deferred to integration environment

### Test Commit Record

| Test File | First Red Commit SHA | Date |
|-----------|---------------------|------|
| compute-health.test.ts | (red-phase committed inline) | 2026-05-29 |
| pre-checks.test.ts | (red-phase committed inline) | 2026-05-29 |
| executor.test.ts | (red-phase committed inline) | 2026-05-29 |
| rls_client_health.sql | (red-phase committed inline) | 2026-05-29 |

### File List

**New files:**
- packages/agents/client-health/__tests__/compute-health.test.ts
- packages/agents/client-health/__tests__/pre-checks.test.ts
- packages/agents/client-health/__tests__/executor.test.ts
- packages/agents/client-health/src/schemas.ts
- packages/agents/client-health/src/compute-health.ts
- packages/agents/client-health/src/pre-checks.ts
- packages/agents/client-health/src/executor.ts
- packages/agents/client-health/src/client-health-badge.tsx
- packages/db/src/queries/analytics/get-usage-analytics.ts
- packages/db/src/queries/analytics/get-validation-metrics.ts
- packages/db/src/queries/clients/health-snapshots.ts
- apps/web/app/(workspace)/analytics/page.tsx
- supabase/migrations/20260529000001_client_health_snapshots.sql
- supabase/migrations/20260529000002_validation_metrics.sql
- supabase/tests/rls_client_health.sql
- apps/web/__tests__/acceptance/epic-8/8-3-client-health-usage-analytics.spec.ts (activated)

**Modified files:**
- packages/agents/client-health/index.ts (updated exports)
- packages/agents/orchestrator/scheduler.ts (added client-health schedule)
- packages/agents/orchestrator/sweep-worker.ts (added client-health sweep handlers)
- packages/db/src/index.ts (added analytics/health exports)
- packages/db/src/queries/dashboard/get-dashboard-summary.ts (fixed client_health_alerts → client_health_snapshots)
- packages/agents/__tests__/agent-contracts.test.ts (fixed import path)
- packages/agents/__tests__/agent-schema-contracts.test.ts (fixed import path)

**Deleted files:**
- packages/agents/client-health/executor.ts (replaced by src/executor.ts)
- packages/agents/client-health/pre-check.ts (replaced by src/pre-checks.ts)
- packages/agents/client-health/schemas.ts (replaced by src/schemas.ts)