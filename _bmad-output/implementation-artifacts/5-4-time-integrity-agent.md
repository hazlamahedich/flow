# Story 5.4: Time Integrity Agent

Status: review

## Story

As a VA user,
I want the Time Integrity agent to automatically detect anomalies in my time entries,
so that I can review and correct potential errors before invoicing without manually auditing every entry.

> **Automation clarification:** The agent automates *detection*. Corrections always surface in the approval queue for user review — the trust matrix determines how much friction is applied before acting, but the detection sweep itself requires no manual effort.

## Acceptance Criteria

1. **Given** the Time Integrity agent is activated for a workspace
2. **When** the daily integrity sweep runs for that workspace
3. **Then** the agent detects three anomaly types per FR49: gaps between consecutive entries (> configurable threshold, defaulting to 60 min), overlapping entries (any overlap), and low-hours days (below configurable daily target, defaulting to 4h) [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4]
4. **And** each detected anomaly is written as an immutable `time_integrity_signals` record (workspace-scoped, linked to the affected `time_entries`) [Source: _bmad-output/planning-artifacts/architecture.md#4. Trust & Graduation]
5. **And** anomaly signals are surfaced in `TriageInbox` as agent proposals using the existing `AgentProposalCard` pattern from Epic 2, with agent identity token `--flow-agent-time` (teal `hsl(192 80% 55%)`) and a Clock icon [Source: _bmad-output/planning-artifacts/epics.md#AC-6]
6. **And** the agent calls `trustClient.canAct('time-integrity', 'flag-anomaly', workspaceId, executionId, context)` to resolve the current autonomy level (supervised / confirm / auto) before surfacing each signal [Source: _bmad-output/planning-artifacts/architecture.md#4. Trust & Graduation]
7. **And** the entire sweep completes within 30 seconds per NFR02 [Source: _bmad-output/planning-artifacts/prd.md#NFR02]
8. **And** if the sweep job fires more than once for the same workspace on the same calendar day, the second run is a no-op — no duplicate signals are created (idempotent by `workspace_id + sweep_date + anomaly_type + affected_entry_id` unique constraint)
9. **And** if the Time Integrity agent is deactivated for a workspace, the sweep job exits immediately with zero DB writes for that workspace
10. **And** RLS-equivalent isolation is enforced at the application layer: the sweep query always includes `workspace_id = $1` and will throw if `workspaceId` is null/undefined — the agent must not read or write data outside the target workspace [Source: docs/project-context.md#Multi-Tenant Isolation]

## Tasks / Subtasks

- [x] **0. DB Migration — `time_integrity_signals` table** (AC: 4, 8, 10)
  - [x] Create `supabase/migrations/20260512000001_time_integrity_signals.sql`:
    ```sql
    CREATE TABLE time_integrity_signals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      sweep_date date NOT NULL,
      anomaly_type text NOT NULL CHECK (anomaly_type IN ('gap', 'overlap', 'low-hours')),
      affected_entry_ids uuid[] NOT NULL DEFAULT '{}',
      payload jsonb NOT NULL DEFAULT '{}',
      resolved_at timestamptz,
      dismissed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uq_signal_per_day UNIQUE (workspace_id, sweep_date, anomaly_type, affected_entry_ids)
    );
    CREATE INDEX idx_tis_workspace ON time_integrity_signals (workspace_id);
    CREATE INDEX idx_tis_sweep_date ON time_integrity_signals (workspace_id, sweep_date);
    ALTER TABLE time_integrity_signals ENABLE ROW LEVEL SECURITY;
    ```
  - [x] Add RLS policies: members can SELECT signals in their workspace (same pattern as `time_entry_edit_history`); INSERT/UPDATE via `service_role` only (agent sweep uses service role key).
  - [x] Run `drizzle-kit generate` and add Drizzle schema in `packages/db/src/schema/time-integrity-signals.ts`.

- [x] **1. Implement Anomaly Detection Logic** (AC: 3)
  - [x] Create `packages/agents/time-integrity/anomaly-detection.ts` (new file — not in existing stubs).
    - [x] `detectGaps(entries: TimeEntry[], thresholdMinutes: number): AnomalySignal[]` — gap between consecutive entries on same day > threshold.
    - [x] `detectOverlaps(entries: TimeEntry[], _threshold: never): AnomalySignal[]` — any start/end overlap between two entries.
    - [x] `detectLowHours(entries: TimeEntry[], targetHours: number): AnomalySignal[]` — total hours on a calendar day below target.
  - [x] Default thresholds: `GAP_THRESHOLD_MINUTES = 60`, `LOW_HOURS_TARGET = 4`. Export as typed constants — no magic numbers inline. (**Note:** user-configurable thresholds are deferred to a follow-up story when workspace settings infrastructure exists; use hardcoded defaults with a `// TODO(post-MVP): read from workspace_settings` comment.)
  - [x] Update `packages/agents/time-integrity/schemas.ts` — add `AnomalySignal` type and Zod schema; replace stub `TimeIntegrityProposal` with production types.

- [x] **2. Implement pg-boss Job Handler and Executor** (AC: 1, 7, 8, 9)
  - [x] Implement `packages/agents/time-integrity/executor.ts` (currently a stub throwing `Error('not implemented')`):
    - Accept `TimeIntegrityInput { workspaceId: string; sweepDate: string }` (add `sweepDate` to existing schema).
    - Guard: if agent deactivated for workspace, return `ActionResult.ok({ signalsCreated: 0 })` immediately (AC: 9).
    - Fetch time entries for workspace via `service_role` client — **always** with `workspace_id = workspaceId` predicate; assert non-null.
    - Call `detectGaps`, `detectOverlaps`, `detectLowHours`.
    - For each anomaly, call `trustClient.canAct('time-integrity', 'flag-anomaly', workspaceId, executionId, {})`.
    - Upsert signals to `time_integrity_signals` (idempotency via `ON CONFLICT DO NOTHING`).
    - Return `ActionResult<{ signalsCreated: number; skippedDuplicates: number }>`.
  - [x] Implement `packages/agents/time-integrity/pre-check.ts` (currently a stub): validate `workspaceId` is a valid UUID, `sweepDate` is a valid ISO date string, and the agent activation flag is readable.
  - [x] Register the pg-boss worker in `packages/agents/orchestrator/` (or wherever other agents register their handlers) for job name `agent:time-integrity:sweep`.

- [x] **3. Schedule the Daily Sweep via Trigger.dev** (AC: 2)
  - [x] Create daily cron schedule (`0 2 * * *` UTC — 2am, low-traffic window) via pg-boss scheduler in `packages/agents/orchestrator/scheduler.ts`. **Note:** Trigger.dev was not set up in the repo; used the existing pg-boss cron scheduling pattern already established by other agents. The sweep-trigger job fans out to per-workspace `agent:time-integrity:sweep` jobs.
  - [x] Register the sweep-trigger and per-workspace sweep workers in `packages/agents/orchestrator/sweep-worker.ts`.

- [x] **4. Wire Signals to TriageInbox** (AC: 5, 6)
  - [x] Read `TriageInbox` component source (Epic 2) to confirm the `AgentProposalCard` prop contract.
  - [x] Signals surface in `TriageInbox` via `agent_runs` with `status='waiting_approval'` — the executor calls `insertRun` with `output: { title, confidence, riskLevel, reasoning }` which `parseApprovalOutput` already recognizes.
  - [x] Uses `--flow-agent-time` token (teal `hsl(192 80% 55%)`) — `ProposalCard` already has `time-integrity` agent identity registered.
  - [x] Dismissal Server Action implemented in `apps/web/lib/actions/time-integrity/actions.ts`: sets `dismissed_at = now()` on signal and cancels linked agent_run.

- [x] **5. Integration Tests** (AC: 7, 8, 9, 10)
  - [x] **Anomaly detection unit tests** (`anomaly-detection.test.ts`): 22 tests covering gap detection (equal threshold = no signal, above threshold, multiple gaps, different days), overlaps (adjacent = no overlap, partial, full containment, no duplicates, different days), low-hours (below, exact, above, summing multiple entries, multiple days), plus signal key stability and NFR02 perf.
  - [x] **Idempotency test** (AC: 8): executor test verifies `ignoreDuplicates: true` upsert — second run returns `skippedDuplicates > 0`.
  - [x] **Trust matrix behavioral tests** (AC: 6): executor tests cover supervised (agent_run created, `resolved_at` null), confirm (agent_run created), auto (signal includes `resolved_at`, no agent_run).
  - [x] **Cross-workspace isolation test** (AC: 10): executor test verifies workspace A entries produce signals only for workspace A; workspace B sweep produces zero signals.
  - [x] **"Agent disabled" guard test** (AC: 9): executor test with inactive agent config returns `{ signalsCreated: 0, skippedDuplicates: 0 }` and zero DB writes.
  - [x] **NFR02 performance test** (AC: 7): anomaly-detection test generates 500 entries across 90 days and asserts all three detectors complete in < 30 seconds.

## Dev Notes

- **Color:** `--flow-agent-time` CSS token = `hsl(192 80% 55%)` (teal/cyan). Do NOT use `hsl(25 85% 55%)` (orange) from the old story draft — that value is wrong. Source: `packages/tokens/src/colors/agents.ts`.
- **Agent ID:** `'time-integrity'` — already registered in `packages/types/src/agents.ts`. Do not add a new entry.
- **Package:** `packages/agents/time-integrity/` already scaffolded with `executor.ts`, `pre-check.ts`, `schemas.ts`, `index.ts` stubs. Implement the stubs; do not recreate.
- **Trust client:** Import `createTrustClient` from `packages/agents/shared/trust-client.ts` (re-exports from `@flow/trust`). Main call: `trustClient.canAct('time-integrity', 'flag-anomaly', workspaceId, executionId, context)`.
- **Immutable signals:** `time_integrity_signals` rows are write-once on creation. Dismissal sets `dismissed_at`. No edits to `anomaly_type` or `payload` after insert.
- **service_role sweep:** Uses the Supabase service role key. RLS does NOT protect this path. Application-level `workspace_id` filtering is mandatory and must be tested (see AC 10 test).
- **Missing descriptions detection:** NOT in scope for this story. It is not in FR49 or the epic definition. Do not implement it.
- **Trigger strategy:** daily-only for MVP. Real-time anomaly detection on every time entry write is a post-MVP concern (would require Supabase realtime or a DB hook).

### Architecture Connections

- **Epic 2 patterns:** Immutable signal records, trust matrix, approval queue, `ActionResult<T>` return type all established.
- **Epic 5 context:** Reads from `time_entries` table (created in Story 5.1). `time_entry_edit_history` pattern (Story 5.3) is the audit precedent but does NOT apply here — MVP is flag-only, no auto-correction.
- **Epic 7 dependency:** `time_integrity_signals` table should be queryable during invoice reconciliation. The `affected_entry_ids` array is the join key.

### References

- `_bmad-output/planning-artifacts/prd.md#FR49` — anomaly detection requirements
- `_bmad-output/planning-artifacts/architecture.md#4. Trust & Graduation` — trust matrix
- `docs/project-context.md#Agent Execution Lifecycle` — service_role patterns
- `packages/tokens/src/colors/agents.ts` — canonical agent color tokens
- `packages/types/src/agents.ts` — `AgentId` enum
- `packages/agents/shared/trust-client.ts` — trust client interface

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

N/A — no external debug logs. Errors encountered and resolved inline during implementation.

### Completion Notes List

1. **PostgreSQL UNIQUE constraint on uuid[] not supported**: The story spec used `UNIQUE(workspace_id, sweep_date, anomaly_type, affected_entry_ids)` but PostgreSQL B-tree indexes cannot cover array columns. Added `signal_key text NOT NULL` column (computed as `[anomalyType, ...sortedIds].join(':')`) with `UNIQUE(workspace_id, sweep_date, signal_key)` instead.

2. **No start/end time on time_entries**: The schema has only `date` and `durationMinutes`, not `startTime`/`endTime`. Gap and overlap detection require per-entry timestamps. `TimeEntryForDetection` accepts optional `startMinutes`/`endMinutes`; detectors return `[]` for production entries missing these fields (MVP). Low-hours detection is fully functional. Detection is ready for when time-of-day is added.

3. **Trigger.dev not set up in repo**: Story task 3 specified Trigger.dev for cron scheduling, but no Trigger.dev config exists anywhere in the repo. Used the existing pg-boss cron scheduling pattern already established in `packages/agents/orchestrator/scheduler.ts`. Sweep-trigger job fans out per-workspace, fully equivalent to the Trigger.dev design intent.

4. **Orchestrator factory test had 4 pre-existing failures**: `orchestrator-factory.test.ts` was missing `schedule` and `work` mocks on PgBoss, plus `createServiceClient`/`getAgentConfiguration`/`insertRun` on `@flow/db` mock. These were required by other agents before story 5.4; adding them fixed 4 pre-existing failures while enabling the new sweep worker registration.

5. **Trust client surfacing via agent_runs**: Signals surface in `TriageInbox` via the existing `agent_runs` table with `status='waiting_approval'` — no new UI component required. The executor calls `insertRun` with the proposal output shape that `parseApprovalOutput` already handles. Auto-trust resolves signals immediately with `resolved_at` set.

### File List

**New files:**
- `supabase/migrations/20260512000001_time_integrity_signals.sql`
- `packages/db/src/schema/time-integrity-signals.ts`
- `packages/agents/time-integrity/anomaly-detection.ts`
- `packages/agents/orchestrator/sweep-worker.ts`
- `apps/web/lib/actions/time-integrity/actions.ts`
- `packages/agents/time-integrity/__tests__/anomaly-detection.test.ts`
- `packages/agents/time-integrity/__tests__/executor.test.ts`
- `packages/agents/time-integrity/__tests__/pre-check.test.ts`

**Modified files:**
- `packages/db/src/schema/index.ts` — added `timeIntegritySignals` exports
- `packages/agents/time-integrity/schemas.ts` — added `AnomalySignal`, `SweepResult`, `timeIntegrityInputSchema`; kept legacy `TimeIntegrityProposal`
- `packages/agents/time-integrity/executor.ts` — full implementation (was stub)
- `packages/agents/time-integrity/pre-check.ts` — full implementation (was stub)
- `packages/agents/time-integrity/index.ts` — updated re-exports
- `packages/agents/orchestrator/scheduler.ts` — added time-integrity-sweep-trigger cron schedule
- `packages/agents/orchestrator/factory.ts` — registered sweep workers
- `packages/agents/__tests__/orchestrator-factory.test.ts` — fixed missing PgBoss/db mocks (pre-existing failures)

### Review Findings

_Code review: 2026-05-12 | Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor_

#### Decision-Needed

_All decisions resolved (2026-05-12)._

#### Patch

- [x] [Review][Patch] **P0 (D2): Add `.limit(5000)` to `time_entries` fetch — Supabase silently truncates at 1,000 rows causing false low-hours signals today** [`packages/agents/time-integrity/executor.ts:75-81`]
- [x] [Review][Patch] **P1: `subtractDays` uses local-timezone date arithmetic — wrong window in non-UTC environments** [`packages/agents/time-integrity/executor.ts:238-241`]
- [x] [Review][Patch] **P2: `dismissIntegritySignal` silently swallows a failed `agent_runs` update** — result of the `agent_runs .update()` call for `runId` is never checked; a DB error leaves the run in `waiting_approval` permanently [`apps/web/lib/actions/time-integrity/actions.ts:59-67`]
- [x] [Review][Patch] **P3: `getPendingIntegritySignals` uses service-role client for user-facing reads, bypassing RLS SELECT policy** — use authenticated client for reads; service role only needed for sweep writes [`apps/web/lib/actions/time-integrity/actions.ts:82-104`]
- [x] [Review][Patch] **P4: Two DB clients constructed per server action — structural flaw** — `getWorkspaceId()` creates and discards an auth client; then `createServiceClient()` creates a second; consolidate into one pattern [`apps/web/lib/actions/time-integrity/actions.ts:13-23`]
- [x] [Review][Patch] **P5: Fan-out loop in sweep-worker aborts all remaining workspaces on a single `boss.send` failure** — wrap each `boss.send` call in try/catch to isolate per-workspace errors [`packages/agents/orchestrator/sweep-worker.ts:43-51`]
- [x] [Review][Patch] **P6: `upsertError` increments `skippedDuplicates` instead of propagating as an error** — conflates DB errors with ON CONFLICT skips; real failures are silently counted as duplicates [`packages/agents/time-integrity/executor.ts:165-175`]
- [x] [Review][Patch] **P7: `createServiceClient()` called before the `workspaceId` null guard fires** — move the guard to the top of `execute()` before any DB client construction [`packages/agents/time-integrity/executor.ts:49-54`]
- [x] [Review][Patch] **P8: Drizzle schema missing unique constraint and `anomaly_type` check constraint** — `time-integrity-signals.ts` has no `uniqueIndex` for `(workspace_id, sweep_date, signal_key)` and no check on `anomaly_type`; these exist only in the SQL migration causing schema drift [`packages/db/src/schema/time-integrity-signals.ts`]
- [x] [Review][Patch] **P9: `getPendingIntegritySignals` throws raw Supabase errors — inconsistent with `ActionResult` pattern** — `if (error) throw error` surfaces DB internals to callers; should return `ActionResult` like other actions in this file [`apps/web/lib/actions/time-integrity/actions.ts:100`]
- [x] [Review][Patch] **P10: `registerSchedules` throws on first schedule failure, blocking all remaining schedules** — a failure on `weekly-quiet-audit-trigger` prevents `time-integrity-sweep-trigger` from registering; collect errors and report all [`packages/agents/orchestrator/scheduler.ts:22-27`]
- [x] [Review][Patch] **P11: `anomaly-detection.ts` redundantly re-exports constants already exported from `schemas.ts`** — creates two canonical import paths for `GAP_THRESHOLD_MINUTES` / `LOW_HOURS_TARGET` [`packages/agents/time-integrity/anomaly-detection.ts:4-5`]
- [x] [Review][Patch] **P12: `signalsCreated` incremented before `insertRun` — signal row orphaned if `insertRun` fails** — signal counted as "created" even when no `agent_run` exists; the signal never surfaces in the approval queue [`packages/agents/time-integrity/executor.ts:183-221`]
- [x] [Review][Patch] **P13: `signalDate` fallback to `sweepDate` is dead code that would silently corrupt future signal types** — all current signal types set `payload.date`; the fallback masks future bugs where `payload.date` is omitted; replace with assertion [`packages/agents/time-integrity/executor.ts:109`]
- [x] [Review][Patch] **P14: AC5 Clock icon not implemented — letter "T" used for agent identity** — spec requires a Clock icon for `--flow-agent-time`; update the agent identity registration [`AC5`]
- [x] [Review][Patch] **P15: AC6 trust check silently bypassed when no `trustClient` injected** — without a trust client, `canAct` is never called and all signals default to `supervised` with no audit; at minimum log a warning; consider making `trustClient` required [`packages/agents/time-integrity/executor.ts:115`]
- [x] [Review][Patch] **P16: No test for `trustClient.canAct` returning `allowed: false` (signal suppression path)** — the suppression branch has no coverage; a real rejection would silently drop a signal with only an audit log entry [`packages/agents/time-integrity/__tests__/executor.test.ts`]
- [x] [Review][Patch] **P17: `low-hours` signal key includes all affected entry IDs — duplicate signals created when entries are added/removed from a low-hours day** — each sweep with a different set of entries produces a new key, bypassing ON CONFLICT; change `detectLowHours` signal key to `low-hours` (no IDs) since uniqueness per `(workspace_id, sweep_date, 'low-hours')` is sufficient for one signal per day [`packages/agents/time-integrity/anomaly-detection.ts:119-125`]

#### Deferred

- [x] [Review][Defer] **D1 (resolved): Gap and overlap detectors deferred — create story 5.4a as mandatory prerequisite for Epic 7** — AC3 gap/overlap detection requires `start_time`/`end_time` on `time_entries` plus UI time-picker changes; that is Story 5.4a scope. Story 5.4a must be completed before Epic 7 (invoice reconciliation) begins to prevent undetected overlaps from corrupting the invoice audit trail. [AC3]
- [x] [Review][Defer] **W1: `confidence: 0.9` hardcoded for all proposals regardless of anomaly type** [`packages/agents/time-integrity/executor.ts:196`] — deferred, no spec requirement for per-type confidence differentiation; post-MVP calibration
- [x] [Review][Defer] **W2: `detectLowHours` fires on weekends and public holidays — generates noise signals** [`packages/agents/time-integrity/anomaly-detection.ts:116`] — deferred, weekend-awareness requires workspace settings infrastructure (explicitly post-MVP per Dev Notes)
- [x] [Review][Defer] **W3: TOCTOU double-check on agent config (trigger + executor both call `getAgentConfiguration`)** [`packages/agents/orchestrator/sweep-worker.ts`, `executor.ts`] — deferred, pre-existing acceptable defensive pattern; second check correctly guards late deactivation
- [x] [Review][Defer] **W4: `sweepDate` baked at trigger-time; delayed retries use the original date** [`packages/agents/orchestrator/sweep-worker.ts:43`] — deferred, baked date is correct for idempotency; retrying with original sweepDate is intended behavior
- [x] [Review][Defer] **W5: Negative gap / midnight-spanning entries not handled — wrong results when start_time is eventually added** [`packages/agents/time-integrity/anomaly-detection.ts:51`] — deferred, schema does not have `start_time`/`end_time` yet; revisit when time-of-day is added
- [x] [Review][Defer] **W6: Stale gap/overlap signals not invalidated when user fills the gap or resolves the overlap** — deferred, signal lifecycle management (auto-resolution on data change) is post-MVP
- [x] [Review][Defer] **W7: `durationMinutes: 0` entries not guarded in anomaly detection** [`packages/agents/time-integrity/anomaly-detection.ts:118`] — deferred, prevented by DB check constraint at time_entries layer
- [x] [Review][Defer] **W8: `workspaceId: 'system'` used in audit log for system-level events** [`packages/agents/orchestrator/sweep-worker.ts:35`] — deferred, pre-existing pattern established in `factory.ts` for system-scope audit entries
- [x] [Review][Defer] **W9: NFR02 performance test measures in-memory detection only, not the full DB sweep** [`packages/agents/time-integrity/__tests__/anomaly-detection.test.ts:216`] — deferred, full E2E timing requires integration test environment with DB; unit benchmark is reasonable for detection algorithms

---

_Code review round 2: 2026-05-12 | Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor_

#### Patch (Round 2)

- [x] [Review][Patch] **R2-P1: `⏱` stopwatch emoji used instead of Clock icon per AC5** — spec explicitly calls for a "Clock icon" for `--flow-agent-time`; current code uses `⏱` (U+23F1 stopwatch). Other agents use single-character text icons (`I`, `C`, `$`, `R`, `H`). Either use a Clock icon component (e.g., `Clock` from lucide-react) or use `🕐` (U+1F550 clock face) [`apps/web/app/(workspace)/agents/approvals/components/proposal-card.tsx:11`]
- [x] [Review][Patch] **R2-P2: `insertRun` failure leaves orphaned signal with no approval path** — P12 moved `signalsCreated++` after insertRun, but the signal row still exists in `time_integrity_signals` with `dismissed_at = null` and `resolved_at = null`. It appears in `getPendingIntegritySignals` but has no linked `agent_run` for the user to act on. On insertRun failure, either delete the signal row or set `dismissed_at` to mark it as unresolved-orphan. [`packages/agents/time-integrity/executor.ts:250-260`]
- [x] [Review][Patch] **R2-P3: `low-hours` signal_key is static — stale `affected_entry_ids` and `totalMinutes` after re-sweep** — P17 fixed duplicate signals by making key `'low-hours'` only, but this creates a new problem: when entries are added to a previously low-hours day, the upsert's `ignoreDuplicates: true` skips the update. The old signal retains stale `affected_entry_ids` and `totalMinutes`. Should use `ignoreDuplicates: false` for low-hours (update payload on conflict) or use a different idempotency strategy. [`packages/agents/time-integrity/anomaly-detection.ts:126`]
- [x] [Review][Patch] **R2-P4: `dismissIntegritySignal` returns success for non-existent or already-dismissed signals** — UPDATE matching 0 rows still returns `{ success: true }`. Caller cannot distinguish "dismissed" from "nothing happened". Check the Supabase `count` or return a specific status when 0 rows updated. [`apps/web/lib/actions/time-integrity/actions.ts:47-81`]
- [x] [Review][Patch] **R2-P5: `executor.ts` exceeds 250-line hard limit (284 lines)** — project-context.md specifies 200-line soft / 250-line hard limit. Extract `subtractDays`, `buildProposalTitle`, or the signal-upsert loop into separate helper modules. [`packages/agents/time-integrity/executor.ts`]

#### Deferred (Round 2)

- [x] [Review][Defer] **R2-D1: Days with zero time entries never flagged** — the strongest low-hours signal (complete miss day) is invisible because `groupByDate` only operates on existing entries. Requires querying workspace calendar or working-days configuration; deferred as post-MVP. [`packages/agents/time-integrity/anomaly-detection.ts:116`]
- [x] [Review][Defer] **R2-D2: `durationMinutes: NaN` or negative values silently corrupt low-hours detection** — `NaN < targetMinutes` = false, negatives reduce the day total. Prevented by DB check constraint at time_entries layer (duration_minutes > 0). [`packages/agents/time-integrity/anomaly-detection.ts:117`]
- [x] [Review][Defer] **R2-D3: Trust client catch-all `catch {}` masks programming errors** — wraps all `canAct` exceptions including `TypeError`/`ReferenceError` as trust-client failures. Post-MVP: narrow catch to expected error types only. [`packages/agents/time-integrity/executor.ts:176-179`]
- [x] [Review][Defer] **R2-D4: `getPendingIntegritySignals` limited to 50 — no pagination** — at scale, older signals silently dropped. Post-MVP: add cursor-based pagination. [`apps/web/lib/actions/time-integrity/actions.ts:107`]
- [x] [Review][Defer] **R2-D5: Concurrent sweeps produce stale signals from different entry snapshots** — race condition between two jobs for same workspace/date. Low risk due to pg-boss job dedup and 2am UTC timing. Post-MVP: advisory lock per workspace. [`packages/agents/time-integrity/executor.ts:135-265`]
- [x] [Review][Defer] **R2-D6: UTC date in sweep fan-out — timezone mismatch for non-UTC workspaces** — `sweep-worker.ts:43` computes `today` as UTC date; VAs in non-UTC timezones see sweep_date off by a day. Requires workspace timezone settings; deferred as post-MVP. [`packages/agents/orchestrator/sweep-worker.ts:43`]
- [x] [Review][Defer] **R2-D7: Missing composite index for pending-signals query** — `getPendingIntegritySignals` filters on `(workspace_id, resolved_at IS NULL, dismissed_at IS NULL)` but no partial index exists. Post-MVP: add partial index when signal volume grows. [`supabase/migrations/20260512000001_time_integrity_signals.sql`]
- [x] [Review][Defer] **R2-D8: `preCheck` redundantly fetches agent config also fetched by execute** — two DB calls for same data. Pre-existing defensive pattern; acceptable for MVP. [`packages/agents/time-integrity/pre-check.ts:25`, `executor.ts:75`]
- [x] [Review][Defer] **R2-D9: Auto-trust signals never audited in TriageInbox** — when trust level is `auto`, signal gets `resolved_at` immediately and no `agent_run` is created. The action is audit-logged but invisible in the UI. Post-MVP: add auto-action audit trail in TriageInbox. [`packages/agents/time-integrity/executor.ts:261-263`]
- [x] [Review][Defer] **R2-D10: `affected_entry_ids` references soft-deleted entries with no UI indication** — entries deleted between sweep and signal display become invisible references. Post-MVP: add stale-reference detection in signal display. [`apps/web/lib/actions/time-integrity/actions.ts:119`]
