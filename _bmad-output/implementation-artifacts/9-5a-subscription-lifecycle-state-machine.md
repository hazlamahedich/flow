# Story 9.5a: Subscription Lifecycle State Machine

Status: in-progress

<!--
Story 9.5a — first slice of the formal 9-5 split (epic-9-planning-review.md §6).
Scope: STATE MACHINE ONLY — extend subscription_status with `suspended` + `deleted`,
define + enforce transitions (Active → Past Due → Suspended → Deleted), grace-period
sweep (7d), suspension sweep (30d), nightly reconciliation job, reactivation paths.
Pure backend; no UI, no agent-orchestrator wiring (that's 9-5b), no tier-limit
enforcement (already in 9-4), no downgrade data preservation (9-5b), no read-only
enforcement (that is 9-5b's orchestrator guard / RLS write-blocking). 9-5a owns the
state machine, the transitions, and the audit trail; it does NOT enforce UI/agent
behavior.

CRITICAL — DO NOT REINVENT. The following already exist and MUST be reused:
  - apps/web/lib/config/tier-config.ts → getTierConfig() ALREADY reads
    `subscription_grace_period_days` and `subscription_suspension_period_days`
    via `Promise.all` (L76-77) and exposes them as `.windows.grace_period_days`
    and `.windows.suspension_period_days` on `TierConfig` (L94-97). Both keys
    are ALREADY seeded by 9-3a migration `20260618000002_app_config_tier_seeding.sql`
    (L27-33: grace=7, suspension=30). 9-5a uses this ONLY in user-facing code;
    sweeps/reconciliation MUST read `app_config` directly via `createServiceClient`
    to preserve dependency direction (packages cannot import apps/web). Do NOT
    re-seed, DO NOT extend `TierConfig`, DO NOT introduce a parallel UI reader.
    UI access path: `(await getTierConfig()).windows.grace_period_days`.
    Worker access path: `select value from app_config where key = 'subscription_grace_period_days'`.
  - packages/types/src/subscription.ts → subscriptionStatusSchema currently has
    `free|active|past_due|cancelled`. The file's own comment (L12-14) says
    "suspended/deleted/trialing are NOT in 9-3a's migration and belong to 9-5a."
    THIS STORY ADDS THEM.
  - supabase/migrations/20260618000001_workspace_subscription_columns.sql → CHECK
    constraint (L19-22) only allows `free|active|past_due|cancelled`. The two RPCs
    `upsert_workspace_subscription` (L114) and `set_workspace_subscription_status`
    (L190) hardcode the same 4-state allowlist. 9-5a migration extends all three.
  - apps/web/lib/stripe/handlers/subscription-updated.ts → handleSubscriptionDeleted
    (L129-161) currently sets status to `cancelled` on `customer.subscription.deleted`.
    Per FR59 + spike §6.1, this event should trigger the SUSPENSION flow (read-only,
    30-day window) — NOT mark the workspace as user-cancelled. 9-5a UPDATES this
    handler to transition to `suspended` via a new RPC `transition_to_suspended_any`
    that does `UPDATE ... WHERE subscription_status IN ('active','past_due','cancelled')`.
    This is the canonical source of the `cancelled → suspended` transition (EC5).
  - packages/agents/orchestrator/scheduler.ts → SCHEDULES array + registerSchedules()
    is the canonical pg-boss cron registration point. 9-5a ADDS three daily entries
    (grace sweep + suspension sweep + nightly reconcile). Do not create a parallel scheduler.
  - packages/agents/orchestrator/sweep-worker.ts → ALREADY 728 lines (over the 200-line
    soft limit). DO NOT append the new boss.work handlers here. Create a SIBLING file
    `packages/agents/orchestrator/lifecycle-sweep-worker.ts` exporting
    `registerLifecycleSweepWorkers(boss)` (mirrors the `registerSweepWorkers` pattern at
    L66) and register it from `factory.ts` L94 alongside the existing call. Define a
    NEW `LifecycleTriggerPayload` type in that file (do NOT extend the existing
    `SweepTriggerPayload.trigger` union at sweep-worker.ts:11 — keep new types local).
  - packages/agents/orchestrator/factory.ts:86-94 → calls `registerSchedules(boss)` +
    `registerSweepWorkers(boss, trustClient)`. 9-5a ADDS a third call:
    `await registerLifecycleSweepWorkers(boss)`. Use the same dynamic-import pattern as L93.
  - apps/web/lib/actions/billing/_helpers.ts → fetchWorkspaceForBilling,
    requireOwner, toFailure, withTenantContext. Reuse for reconcileSubscriptionsAction
    if it ever touches user context (it doesn't — it's system-level; but keep the
    pattern in mind).
  - apps/web/lib/stripe/handlers/index.ts → processStripeEvent dispatcher. NO new
    event types needed in 9-5a (customer.subscription.deleted is already routed).

DEPENDS ON: 9-4 (DONE — enforceTierLimit, changeTierAction), 9-3b (DONE —
cancel/reactivate actions, billing page), 9-3a (DONE — webhook infra, RPCs, columns).
BLOCKS: 9-5b (needs `suspended`/`deleted` to be valid DB statuses so the
orchestrator guard clause can branch on them).

ATDD scaffold (RED, currently passing via inline stubs):
  apps/web/__tests__/acceptance/epic-9/9-5a-subscription-lifecycle-state-machine.spec.ts
-->

## Story

As a workspace owner,
I want my subscription to progress through a well-defined lifecycle when payments fail or subscriptions end,
so that I have predictable grace periods to recover my access, my data is never silently destroyed, and the system self-corrects when Stripe and the database disagree.

> Stakeholder impact: when a payment fails, an owner gets a 7-day grace window (read-write) before being suspended to read-only for 30 days, and only then is the workspace hard-deleted. Reactivation is possible at any point before deletion. A nightly reconciliation job catches any drift between Stripe's view and ours. No owner action is required for normal tier operation — this story only fires on payment failure, manual cancellation at period end, or webhook/reconciliation drift.

## Traceability

| AC | Scenario | PRD / NFR tag |
|---|---|---|
| AC1 | `subscription_status` extended with `suspended` + `deleted`; schema + RPCs + CHECK constraint aligned | **FR59** |
| AC2 | State transition map enforces Active → Past Due → Suspended → Deleted; invalid jumps rejected; reactivation paths (past_due→active, suspended→active) honored | **FR59** |
| AC3 | 7-day grace period configurable via `app_config`; daily cron transitions `past_due` → `suspended` after grace expires | **FR59** |
| AC4 | 30-day suspension window configurable via `app_config`; daily cron transitions `suspended` → `deleted` after window expires; `deleted` is terminal | **FR59** |
| AC5 | `customer.subscription.deleted` webhook transitions to `suspended` (read-only entry point), not `cancelled`; `past_due→active` and `suspended→active` recovery honored on payment | **FR59**, **FR42** |
| AC6 | Nightly reconciliation Server Action compares Stripe truth to DB; corrects drift via conditional writes (`WHERE status = $expected`); flags uncorrectable drift for 9-7 | **NFR54**, spike §9.1 |

> **Out of scope (9-5b):** agent orchestrator guard clause (`shouldDequeueForWorkspace`), downgrade data preservation (`applyDowngradeAction`, FR57), auto-upgrade prompts, owner notification surfaces. 9-5a OWNS the state machine and its transitions; 9-5b CONSUMES the resulting statuses.

## Acceptance Criteria

0. **[AC0 — Test-First]** The ATDD scaffold `apps/web/__tests__/acceptance/epic-9/9-5a-subscription-lifecycle-state-machine.spec.ts` (19 tests, currently passing via inline stubs for `subscriptionStatusSchema`, `transitionSubscriptionStatus`, `isTerminalStatus`, `GRACE_PERIOD_DAYS`, `SUSPENSION_MAX_DAYS`, `SUBSCRIPTION_TRANSITIONS`, and a `vi.hoisted` mock for `reconcileSubscriptionsAction`) AND a new unit scaffold `apps/web/__tests__/billing/9-5a-lifecycle.spec.ts` exist and are **red** before implementation. Story cannot be marked `in-progress` until the unit scaffold with failing tests is committed. During GREEN phase, remove the inline stubs from the ATDD spec and replace with real imports (`subscriptionStatusSchema` from `@flow/types`, `transitionSubscriptionStatus` / `isTerminalStatus` / `SUBSCRIPTION_TRANSITIONS` / `GRACE_PERIOD_DAYS` / `SUSPENSION_MAX_DAYS` from `@flow/shared`, `reconcileSubscriptionsAction` from `@/lib/actions/billing/reconcile-subscriptions`) so the 19 ATDD tests assert real behavior. Record the first red-phase commit SHA in the Test Commit Record below.

1. **[AC1 — Status enum extended (FR59)]** The `workspaces.subscription_status` CHECK constraint is extended to allow `('free', 'active', 'past_due', 'cancelled', 'suspended', 'deleted')` via an **append-only** migration `supabase/migrations/20260619000001_subscription_lifecycle_states.sql`. The two existing RPCs (`upsert_workspace_subscription`, `set_workspace_subscription_status`) are updated (or replaced via `CREATE OR REPLACE FUNCTION`) to accept and validate the 6-state allowlist — the hardcoded `IF p_status NOT IN ('free', 'active', 'past_due', 'cancelled')` guards at migration L114 and L190 are extended to include `'suspended', 'deleted'`. A third RPC `transition_workspace_subscription_status(p_workspace_id, p_from_status, p_to_status, p_clear_period_end)` is added for **conditional writes** (Epic 8 retro #5: `UPDATE ... WHERE subscription_status = p_from_status AND id = p_workspace_id RETURNING id`); it returns `{ error: 'PRECONDITION_FAILED' }` when zero rows update (status already moved on — idempotent success per project-context.md:494) and validates `p_to_status` against the CHECK allowlist. The `subscriptionStatusSchema` in `packages/types/src/subscription.ts` becomes `z.enum(['free', 'active', 'past_due', 'cancelled', 'suspended', 'deleted'])`; a narrower `subscriptionLifecycleStatusSchema = z.enum(['free', 'active', 'past_due', 'suspended', 'deleted'])` is exported alongside it for the pure state-machine helpers (the lifecycle excludes `cancelled`, which represents user-scheduled cancel-at-period-end and is orthogonal to the FR59 lifecycle — see Dev Notes "Cancelled vs Suspended").

2. **[AC2 — Transition rules (FR59)]** A pure transition map `SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]>` and function `transitionSubscriptionStatus(from: SubscriptionStatus, to: SubscriptionStatus): { ok: true } | { ok: false; reason: string }` are exported from `packages/shared/src/subscription-lifecycle.ts` (new file — pure logic, cross-package reusable, mirroring the 9-4 pattern that put `checkTierLimit` in `packages/shared`). Allowed transitions: `free→active`, `active→past_due`, `active→suspended` (manual cancel-at-period-end expiry or `customer.subscription.deleted` direct jump), `active→cancelled` (user-scheduled cancel, set by 9-3b's existing flow), `past_due→suspended` (grace expired), `past_due→active` (payment recovery), `suspended→deleted` (30-day window expired), `suspended→active` (reactivation), `cancelled→suspended` (cancel-at-period-end subscription finally ends). `isTerminalStatus(status): boolean` returns `true` only for `deleted`. Direct jumps `active→deleted`, `past_due→deleted`, `free→suspended`, `free→deleted`, `cancelled→active` (must re-subscribe via Stripe checkout/portal, not a direct lifecycle jump), `cancelled→deleted`, `cancelled→past_due` are REJECTED with a reason string. The narrower `SubscriptionLifecycleStatus` (free|active|past_due|suspended|deleted) is the set on which the automated sweeps/reconciliation operate; `cancelled` is an orthogonal meta-state that may only enter the lifecycle via the `cancelled→suspended` webhook path. All helpers are pure (no I/O, no side effects) and unit-testable in isolation.

3. **[AC3 — Grace period sweep (FR59)]** Two new pg-boss schedule entries are registered in `packages/agents/orchestrator/scheduler.ts` `SCHEDULES` array (do not create a parallel scheduler — Epic 8 retro #6): `{ name: 'subscription-grace-sweep-trigger', cron: '0 2 * * *', data: { type: 'sweep_trigger', trigger: 'subscription_grace_daily' } }` and `{ name: 'subscription-suspension-sweep-trigger', cron: '0 2 * * *', data: { type: 'sweep_trigger', trigger: 'subscription_suspension_daily' } }`. Both run at 02:00 UTC (low-traffic window, mirrors `time-integrity-sweep-trigger` at L19). The grace sweep worker handler (registered via the new `registerLifecycleSweepWorkers(boss)` in `packages/agents/orchestrator/lifecycle-sweep-worker.ts`, NOT appended to the already-728-line `sweep-worker.ts`) calls `runGraceSweep()` from `packages/agents/orchestrator/lifecycle-sweep.ts`. `runGraceSweep` queries `workspaces` for rows with `subscription_status = 'past_due' AND subscription_updated_at < now() - interval '$N days'` where `$N` is read directly from `app_config` key `subscription_grace_period_days` (default 7, seeded by 9-3a migration `20260618000002`; spike §3.3). For each match, it calls the new `transition_workspace_subscription_status` RPC with `p_from_status = 'past_due', p_to_status = 'suspended'`. Conditional write is non-negotiable — it prevents double-transition if the webhook or reconciliation raced (Epic 8 retro #5, project-context.md:494). Uses `createServiceClient()` (system-level cron, per project-context.md:150). On transition, fire `writeAuditLog({ workspaceId, agentId: 'orchestrator', action: 'subscription.transitioned', entityType: 'workspace', details: { from: 'past_due', to: 'suspended', trigger: 'grace_expired' } })` mirroring the scheduler registration pattern at scheduler.ts:62. Note: business logic lives in `packages/agents/orchestrator/lifecycle-sweep.ts` (NOT `apps/web/lib/actions/`) to preserve correct dependency direction — packages cannot import from apps.

4. **[AC4 — Suspension window sweep (FR59)]** The suspension sweep worker handler calls `runSuspensionSweep()` from the same `lifecycle-sweep.ts` module, querying `workspaces` for rows with `subscription_status = 'suspended' AND subscription_updated_at < now() - interval '$N days'` where `$N` is read directly from `app_config` key `subscription_suspension_period_days` (default 30, seeded by 9-3a migration). For each match, it calls `transition_workspace_subscription_status(workspaceId, 'suspended', 'deleted')`. **HARD DELETE IS OUT OF SCOPE** — `deleted` is a soft marker; actual row deletion + GDPR cascade (PII 30d, financial 7y, audit hash-chain preservation per project-context.md:502) is a separate deferred story (10-5 data-export-audit-trail-gdpr-compliance). 9-5a only sets `deleted` as the terminal marker. The owner notification at the 25-day mark ("approaching deletion" warning) is 9-5b's surface — 9-5a writes the audit log row that 9-5b will surface.

5. **[AC5 — Webhook reactivation + deletion routing (FR59, FR42)]** Update `apps/web/lib/stripe/handlers/subscription-updated.ts`: `handleSubscriptionDeleted` (currently L129-161) transitions to `suspended` (NOT `cancelled`) via the new RPC `transition_to_suspended_any(p_workspace_id)` that performs `UPDATE ... SET subscription_status = 'suspended' WHERE id = p_workspace_id AND subscription_status IN ('active','past_due','cancelled')`. This single RPC replaces the three-attempt conditional-write loop discussed in earlier drafts. The existing `handleSubscriptionUpdated` already maps `active|trialing → active` via `mapSubscriptionStatus` (L34-52); the `canceled` Stripe status maps to `cancelled` (owner-scheduled cancel-at-period-end). **No new webhook event types are added** — `customer.subscription.updated` and `customer.subscription.deleted` are already routed in `apps/web/lib/stripe/handlers/index.ts:17-18`. Idempotency: the conditional write (`WHERE status IN (...)` and target not already `suspended`) means a duplicate webhook delivery is a no-op (project-context.md:494 — "already in target state = success"). If the webhook arrives for an already-`suspended` or `deleted` workspace, the RPC returns `{ error: 'PRECONDITION_FAILED' }` and the handler treats it as `processed:true` (idempotent).

6. **[AC6 — Nightly reconciliation (NFR54, spike §9.1)]** A Server Action `reconcileSubscriptionsAction(input?: unknown): Promise<ActionResult<ReconciliationReport>>` is exported from `apps/web/lib/actions/billing/reconcile-subscriptions.ts` (thin wrapper for admin/manual invocation). The CORE logic `runReconciliation(): Promise<ReconciliationReport>` lives in `packages/agents/orchestrator/reconcile-subscriptions.ts` and is invoked BOTH by the wrapper AND by a third pg-boss schedule entry `{ name: 'subscription-reconcile-trigger', cron: '0 3 * * *', data: { trigger: 'subscription_reconcile_nightly' } }` (03:00 UTC, after the two sweep jobs). `runReconciliation` is **system-level** (uses `createServiceClient()` — never user-scoped; reconciliation is a background job). It queries all workspaces with `stripe_subscription_id IS NOT NULL AND subscription_status != 'deleted'`, fetches each subscription's status from Stripe via `getPaymentProvider('stripe').getSubscription(id)`, and for each workspace where `mapped_db_status !== stripe_status`: first validates the transition via `transitionSubscriptionStatus(db_status, stripe_status)` from `@flow/shared`, then calls `transition_workspace_subscription_status(workspaceId, db_status, stripe_status)` with a conditional write. Returns `ReconciliationReport = { checked: number; drift: Array<{ workspaceId: string; fromStatus: string; toStatus: string; corrected: boolean }>; uncorrectable: Array<{ workspaceId: string; reason: string }> }`. Uncorrectable cases (e.g., transition not in `SUBSCRIPTION_TRANSITIONS`, customer mismatch, Stripe error, `PRECONDITION_FAILED`) are logged via `writeAuditLog` with `action: 'subscription.reconciliation_failed'` and surfaced in the report for 9-7's billing-accuracy dashboard. The ATDD contract asserts `result.data.drift` is an array — the GREEN phase must keep this exact shape. Batching is sequential 100-row pages with a per-iteration Stripe rate-limit sleep (configurable, default 100ms) and an overall job timeout guard (throw after 4 hours) so the cron does not run forever; rows beyond the timeout are reported as `uncorrectable` with reason `timeout`.

### Edge Case Matrix

> Mandatory per Epic 7 retro: this is a financial/state-machine story.

| Case | Input / Condition | Expected Behavior | AC Ref |
|------|-------------------|-------------------|--------|
| EC1 | Duplicate `customer.subscription.deleted` webhook arrives 5 min later | `transition_to_suspended_any` conditional write `WHERE status IN ('active','past_due','cancelled')` finds 0 rows (already `suspended` or `deleted`) → RPC returns `PRECONDITION_FAILED` → handler returns `processed:true` (idempotent). No second transition, no audit log duplication. | AC5 |
| EC2 | Webhook arrives before cron sweep (status still `active`, Stripe already deleted subscription) | `transition_to_suspended_any(wsId)` succeeds. Cron sweep the next night finds no `past_due` rows for that workspace — no-op. | AC3, AC5 |
| EC3 | Cron sweep races with webhook recovery (sweep reads `past_due`, webhook flips to `active` mid-sweep) | Sweep's conditional write `WHERE status='past_due'` finds 0 rows → `PRECONDITION_FAILED` → sweep logs `corrected:false, reason:'status_changed_before_sweep'` and moves on. No clobber. | AC3, AC5 |
| EC4 | Reconciliation wants to write `active→suspended` (drift correction) | `transitionSubscriptionStatus('active','suspended')` allows it. If the DB says `past_due` (not `active`), the conditional write `WHERE status='active'` fails → uncorrectable list with reason `'status_changed_before_reconcile'`. | AC2, AC6 |
| EC5 | Workspace in `cancelled` state (user cancel-at-period-end) and period ends | Stripe fires `customer.subscription.deleted` → handler transitions `cancelled→suspended` via the new RPC. 30 days later, suspension sweep → `deleted`. | AC2, AC5 |
| EC6 | `past_due` workspace recovers within grace (7 days) | Stripe fires `invoice.paid` → existing `handleInvoicePaid` (do not modify) calls `set_workspace_subscription_status(wsId, 'active')`. No sweep fires. | AC3 |
| EC7 | `suspended` workspace recovers via new Stripe subscription (owner re-subscribes in portal) | `checkout.session.completed` → existing `handleCheckoutSessionCompleted` already calls `upsert_workspace_subscription(..., 'active')`. The RPC's `UPDATE ... WHERE id = $1` (not conditional on status) succeeds. Workspace is `active` again — past `suspended` state is history. | AC1, AC5 |
| EC8 | `getTierConfig()` throws (placeholder sentinel or config missing) during sweep | Sweep reads `app_config` directly, not `getTierConfig()`. On missing/error it defaults to 7/30, logs via `writeAuditLog` with `action:'subscription.sweep_failed', outcome:'error'`, and continues to next workspace. Does NOT crash the whole sweep. Spike §3.3 + 9-4's `SYSTEM_CONFIG_MISSING` pattern. | AC3, AC4 |
| EC9 | `getPaymentProvider('stripe').getSubscription(id)` throws during reconciliation (Stripe outage, 5xx) | Reconciliation catches per-workspace, adds to `uncorrectable` with `reason:'stripe_api_error'`, continues. Whole reconcile job does NOT fail on one Stripe error. NFR46 retry budget is Stripe’s problem, not ours — we log and move on. | AC6 |
| EC10 | Migration run against a workspace already in an unmapped state (none today, but defense) | The new CHECK constraint is ADDITIVE — existing rows in `free|active|past_due|cancelled` remain valid. No data migration. `suspended`/`deleted` are only set going forward. | AC1 |
| EC11 | pg-boss schedule registration fails on deploy (boss.schedule throws) | `registerSchedules` already collects failures and throws `Failed to register schedule(s): ...` after attempting all (scheduler.ts:54-76). Deployment fails loudly — no silent skip. Same pattern as existing schedules. | AC3, AC4 |
| EC12 | Owner manually re-activates via `reactivateSubscriptionAction` while `suspended` | 9-3b's existing action calls Stripe `resumeSubscription` — Stripe fires `customer.subscription.updated` → `handleSubscriptionUpdated` → `upsert_workspace_subscription(..., 'active')`. The unconditional `UPDATE WHERE id=$1` in the upsert RPC handles this. 9-5a does not need to touch 9-3b's action. | AC5 |
| EC13 | Stripe status `unpaid` or `incomplete_expired` arrives via `customer.subscription.updated` | `mapStripeStatusToDb` maps both to `suspended` (they are terminal payment-failure states with no owner intent). The `customer.subscription.deleted` event may also arrive and is idempotent. | AC5 |

## Pre-Dev Dependency Scan

- [x] Graphify query run — key dependencies listed below
- [x] Dependencies:
  - `apps/web/lib/config/tier-config.ts` (`getTierConfig` — canonical reader for grace/suspension days)
  - `packages/types/src/subscription.ts` (`subscriptionStatusSchema` — to be extended)
  - `packages/shared/src/` (target for new `subscription-lifecycle.ts` pure module)
  - `packages/db/src/index.ts` (`createServiceClient`, `cacheTag`, `requireTenantContext`, `createFlowError`)
  - `packages/agents/orchestrator/scheduler.ts` (`SCHEDULES`, `registerSchedules` — append new entries)
  - `packages/agents/shared/audit-writer.ts` (`writeAuditLog` — used by scheduler + sweeps)
  - `packages/agents/providers/` (`getPaymentProvider('stripe').getSubscription` — for reconciliation)
  - `apps/web/lib/stripe/handlers/subscription-updated.ts` (`handleSubscriptionDeleted` — modify per AC5)
  - `apps/web/lib/stripe/handlers/index.ts` (`processStripeEvent` — NO new event types)
  - `apps/web/lib/actions/billing/_helpers.ts` (billing helpers — reference for ActionResult pattern)
  - `supabase/migrations/20260618000001_workspace_subscription_columns.sql` (existing RPCs + CHECK — to be extended)
  - `apps/web/__tests__/acceptance/epic-9/9-5a-subscription-lifecycle-state-machine.spec.ts` (ATDD scaffold — rewrite in GREEN)
  - `apps/web/__tests__/acceptance/epic-9/9-5b-agent-pause-downgrade-handling.spec.ts` (9-5b consumes statuses — contract verification)
- [x] UX AC review — Sally confirmed no ambiguous ACs (state machine is backend-only; no UX surface in 9-5a)
  - [x] Architect sign-off: APPROVED_WITH_NOTES — file-size watch on `reconcile-subscriptions.ts` (soft cap 180 lines, hard cap 200), webhook RPC decision (`transition_to_suspended_any`), sweep/reconcile exclude `deleted`, batch concurrency + timeout specified.

## Tasks / Subtasks

- [ ] **T1: Migration — extend status enum + seed config (AC: 1)**
  - [ ] T1.1 Create `supabase/migrations/20260619000001_subscription_lifecycle_states.sql`:
    - `ALTER TABLE workspaces DROP CONSTRAINT workspaces_subscription_status_valid, ADD CONSTRAINT workspaces_subscription_status_valid CHECK (subscription_status IN ('free', 'active', 'past_due', 'cancelled', 'suspended', 'deleted'))` (idempotent via `DO $$ ... IF EXISTS ... $$`)
    - `CREATE OR REPLACE FUNCTION upsert_workspace_subscription` — extend the `IF p_status NOT IN (...)` guard at L114 to the 6-state allowlist. Copy the full function body from `20260618000001` migration; only the allowlist line changes. Re-`REVOKE FROM PUBLIC` + `GRANT TO authenticated, service_role`.
    - `CREATE OR REPLACE FUNCTION set_workspace_subscription_status` — same allowlist extension at L190.
    - NEW `CREATE FUNCTION transition_workspace_subscription_status(p_workspace_id UUID, p_from_status TEXT, p_to_status TEXT, p_clear_period_end BOOLEAN DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_catalog AS $$ DECLARE v_updated UUID; BEGIN IF p_to_status NOT IN ('free','active','past_due','cancelled','suspended','deleted') THEN RETURN jsonb_build_object('error','INVALID_STATUS'); END IF; UPDATE workspaces SET subscription_status = p_to_status, subscription_current_period_end = CASE WHEN p_clear_period_end THEN NULL ELSE subscription_current_period_end END WHERE id = p_workspace_id AND subscription_status = p_from_status RETURNING id INTO v_updated; IF v_updated IS NULL THEN RETURN jsonb_build_object('error','PRECONDITION_FAILED'); END IF; RETURN jsonb_build_object('success', true); END; $$;` + `REVOKE FROM PUBLIC` + `GRANT TO authenticated, service_role`. This RPC is intended for callers that already hold workspace-scoped authorization (system cron via `service_role`, webhook route, or an owner-authorized Server Action). For direct user invocation it must only be exposed through an action that verifies ownership; do not call it from unguarded user-facing code.
    - NEW `CREATE FUNCTION transition_to_suspended_any(p_workspace_id UUID) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_catalog AS $$ DECLARE v_updated UUID; BEGIN UPDATE workspaces SET subscription_status = 'suspended' WHERE id = p_workspace_id AND subscription_status IN ('active','past_due','cancelled') RETURNING id INTO v_updated; IF v_updated IS NULL THEN RETURN jsonb_build_object('error','PRECONDITION_FAILED'); END IF; RETURN jsonb_build_object('success', true); END; $$;` + `REVOKE FROM PUBLIC` + `GRANT TO authenticated, service_role`. Called only by the Stripe webhook route (`handleSubscriptionDeleted`) which already validates the Stripe signature; the function itself is `SECURITY DEFINER` and does not re-verify workspace ownership because the webhook is system-authorized by Stripe signature, not user identity. No user-facing Server Action may call this RPC directly.
  - [ ] T1.2 Verify `pnpm exec pgtap` path: if any existing `workspaces_subscription_status_valid` test exists in `supabase/tests/`, add a sibling case asserting `suspended` and `deleted` are accepted. If not, skip — RLS is the perimeter, not the CHECK.
  - [ ] T1.3 Add migration entry to `supabase/migrations/` with down-test comment block (project-context.md:388-396). Down SQL: restore the original 4-state CHECK constraint and `CREATE OR REPLACE` the three RPCs with their original 4-state allowlists; note that down will fail if any row is already in `suspended`/`deleted`, which is acceptable per project-context.md:395-396.

- [ ] **T2: Types & pure state machine (AC: 1, 2)**
  - [ ] T2.1 Update `packages/types/src/subscription.ts`:
    - Extend `subscriptionStatusSchema` to `z.enum(['free', 'active', 'past_due', 'cancelled', 'suspended', 'deleted'])`.
    - Export new `subscriptionLifecycleStatusSchema = z.enum(['free', 'active', 'past_due', 'suspended', 'deleted'])` (excludes `cancelled` — see Dev Notes).
    - Export new `ReconciliationReportSchema` (Zod) for AC6 return type: `{ checked: number, drift: Array<{ workspaceId, fromStatus, toStatus, corrected }>, uncorrectable: Array<{ workspaceId, reason }> }`. Reuse in `reconcile-subscriptions.ts`.
  - [ ] T2.2 Create `packages/shared/src/subscription-lifecycle.ts`:
    - Export `SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]>` (per AC2 map — includes `cancelled` because `active→cancelled` and `cancelled→suspended` are valid transitions).
    - Export `mapStripeStatusToDb(stripeStatus: string): SubscriptionStatus | null` extracted from `apps/web/lib/stripe/handlers/subscription-updated.ts:34-52` and enhanced to map `unpaid`/`incomplete_expired` to `suspended` (Winston recommendation). Maps `active`, `trialing` → `active`; `canceled` (US) → `cancelled` (DB UK); `past_due` → `past_due`; `unpaid`, `incomplete_expired` → `suspended`; `incomplete` → `null`. Unknown values → `null` with no throw.
    - Export `transitionSubscriptionStatus(from, to): { ok: true } | { ok: false; reason: string }` — pure function, no I/O. Returns `{ ok: false, reason: 'invalid_transition: <from>→<to>' }` for disallowed jumps.
    - Export `isTerminalStatus(status): status is 'deleted'` — pure type guard.
    - Export `GRACE_PERIOD_DAYS_DEFAULT = 7` and `SUSPENSION_MAX_DAYS_DEFAULT = 30` as fallbacks (the runtime values come from `app_config` in sweeps and `getTierConfig()` in UI; these defaults are for unit tests + schema defaults).
  - [ ] T2.3 Update `packages/shared/src/index.ts` to re-export everything from `./subscription-lifecycle`.
  - [ ] T2.4 Build: `pnpm --filter @flow/shared build && pnpm --filter @flow/types build` — both packages must compile before any app code imports them.

- [ ] **T3: pg-boss schedule entries (AC: 3, 4, 6)**
  - [ ] T3.1 Edit `packages/agents/orchestrator/scheduler.ts` — append three entries to `SCHEDULES`:
    - `{ name: 'subscription-grace-sweep-trigger', cron: '0 2 * * *', data: { type: 'sweep_trigger', trigger: 'subscription_grace_daily' } }`
    - `{ name: 'subscription-suspension-sweep-trigger', cron: '0 2 * * *', data: { type: 'sweep_trigger', trigger: 'subscription_suspension_daily' } }`
    - `{ name: 'subscription-reconcile-trigger', cron: '0 3 * * *', data: { type: 'sweep_trigger', trigger: 'subscription_reconcile_nightly' } }`
  - [ ] T3.2 Verify no central dispatcher needs editing — each trigger gets its own `boss.work(...)` handler in the new `lifecycle-sweep-worker.ts` (T8). Do NOT modify `sweep-worker.ts` (already 728 lines — over the 200-line soft limit; appending would worsen the god-function pattern).

- [ ] **T4: Sweep logic + worker registration (AC: 3, 4)**
  - [ ] T4.1 Create `packages/agents/orchestrator/lifecycle-sweep.ts` (core business logic, no Next.js/React deps):
    - Export `runGraceSweep(): Promise<SweepSummary>` where `SweepSummary = { swept: number; failed: number; capped: boolean }`. Reads `app_config` directly via `createServiceClient` (skipping the React-`cache()` wrapper in `getTierConfig` — the worker is system-level and doesn’t need React memoization; spike §3.3 confirms the keys exist). Queries `workspaces` for `subscription_status = 'past_due' AND subscription_updated_at < now() - interval '$N days'` where `$N = (await fetchGraceDays())`. Caps iteration at 500 rows (EC safety). For each, calls the new `transition_workspace_subscription_status(wsId, 'past_due', 'suspended')` RPC, writes `writeAuditLog({ workspaceId, agentId: 'orchestrator', action: 'subscription.transitioned', entityType: 'workspace', details: { from: 'past_due', to: 'suspended', trigger: 'grace_expired' } })`, catches per-row errors (EC8). If the RPC returns `PRECONDITION_FAILED` (another process already transitioned the row), treat as idempotent success — count toward `swept` because the desired end-state is reached, but do not write a second audit log. Returns summary.
    - Export `runSuspensionSweep(): Promise<SweepSummary>` — same shape with `suspended → deleted`, uses `(await fetchSuspensionDays())`. Soft-delete only (AC4 — actual row deletion is story 10-5). Identical idempotency rule for `PRECONDITION_FAILED`: count as `swept`, no duplicate audit log.
    - Private helpers `fetchGraceDays()` / `fetchSuspensionDays()` query `app_config` for the two keys; default to 7/30 on missing/error (EC8) — but log the fallback.
  - [ ] T4.2 Create `packages/agents/orchestrator/lifecycle-sweep-worker.ts` (boss.work registration, mirrors sweep-worker.ts L66-728 pattern but isolated):
    - Define `interface LifecycleTriggerPayload { type: 'sweep_trigger'; trigger: 'subscription_grace_daily' | 'subscription_suspension_daily' | 'subscription_reconcile_nightly'; }` — DO NOT extend the existing `SweepTriggerPayload` union in sweep-worker.ts (keep new types local to new code).
    - Export `registerLifecycleSweepWorkers(boss: PgBoss): Promise<void>` that registers THREE `boss.work(...)` handlers — one per trigger. Each handler dynamically imports its action from `./lifecycle-sweep` (or `./reconcile-subscriptions` for reconcile) and invokes it. Set `retryLimit: 2, retryDelay: 60` on `boss.work` options to match existing sweep jobs.
    - File MUST stay under 200 lines. Extract a private `registerLifecycleTrigger(boss, name, handler)` helper to avoid duplication.
  - [ ] T4.3 Edit `packages/agents/orchestrator/factory.ts:93-94` — add `const { registerLifecycleSweepWorkers } = await import('./lifecycle-sweep-worker'); await registerLifecycleSweepWorkers(boss);` after the existing `registerSweepWorkers` call. Use the same dynamic-import pattern as L93.

- [ ] **T5: Reconciliation logic + Server Action wrapper (AC: 6)**
  - [ ] T5.1 Create `packages/agents/orchestrator/reconcile-subscriptions.ts` (core business logic):
    - Export `runReconciliation(): Promise<ReconciliationReport>` where `ReconciliationReport = { checked: number; drift: Array<{ workspaceId: string; fromStatus: string; toStatus: string; corrected: boolean }>; uncorrectable: Array<{ workspaceId: string; reason: string }> }` (Zod-validated schema from T2.1).
    - Uses `createServiceClient()` — system-level. Iterates workspaces with `stripe_subscription_id IS NOT NULL AND subscription_status != 'deleted'`, batched (100 at a time, sequential pages) to bound Stripe API rate use. Sleeps 100ms between Stripe calls to respect rate limits. Enforces an overall job timeout (4 hours) and converts timed-out remaining rows to `uncorrectable` with reason `'timeout'`.
    - For each: `getPaymentProvider('stripe').getSubscription(stripe_subscription_id)` → map Stripe status via `mapStripeStatusToDb` (from `@flow/shared`, extracted in T2.2) → compare to DB status. If differ: first validate `transitionSubscriptionStatus(dbStatus, stripeStatus)` from `@flow/shared`. If invalid → `uncorrectable` with `reason:'invalid_transition'`. If valid, call `transition_workspace_subscription_status(wsId, dbStatus, stripeStatus)` (conditional write). If `PRECONDITION_FAILED` → `drift` with `corrected:false, reason:'status_changed_before_reconcile'`. If Stripe throws → `uncorrectable` with `reason:'stripe_api_error'`. Audit log every correction + uncorrectable case.
    - Returns the report even when uncorrectable cases exist — the report IS the failure surface.
  - [ ] T5.2 Create `apps/web/lib/actions/billing/reconcile-subscriptions.ts` (thin Server Action wrapper for admin/manual invocation, NOT the primary entry point — the nightly cron is):
    - `'use server'` at top.
    - Export `reconcileSubscriptionsAction(input?: unknown): Promise<ActionResult<ReconciliationReport>>`. Validates input (allow empty), delegates to `runReconciliation()` imported from `@flow/agents` (correct dependency direction: apps → packages). Returns `{ success: true, data: report }`.
    - This is a thin wrapper — the ATDD scaffold mock path `@/lib/actions/billing/reconcile-subscriptions` matches this file. Keep ≤80 lines (it’s a pass-through).
  - [ ] T5.3 Verify both files stay under their respective limits: `packages/agents/orchestrator/reconcile-subscriptions.ts` ≤200 lines (extract per-workspace reconcile helper if needed); `apps/web/lib/actions/billing/reconcile-subscriptions.ts` ≤80 lines.

- [ ] **T6: Webhook handler update (AC: 5)**
  - [ ] T6.1 Edit `apps/web/lib/stripe/handlers/subscription-updated.ts`:
    - In `handleSubscriptionDeleted` (L129-161), replace the `set_workspace_subscription_status(wsId, 'cancelled', ..., p_clear_period_end: true)` call with `transition_to_suspended_any(wsId)`. This single RPC handles `active`, `past_due`, and `cancelled` source states in one conditional write (`WHERE subscription_status IN ('active','past_due','cancelled')`).
    - Update the inline comment at L150-153 to reference FR59 and explain why `suspended` (read-only entry) is the correct target instead of `cancelled`.
    - `handleSubscriptionUpdated` is unchanged — `customer.subscription.updated` still routes through `mapSubscriptionStatus` → `upsert_workspace_subscription` (unconditional upsert, not a transition).
  - [ ] T6.3 Update the existing unit test `apps/web/app/api/webhooks/stripe/__tests__/route.test.ts` (or the handler-specific test if one exists in `apps/web/lib/stripe/handlers/__tests__/`) to assert the new `suspended` target on the deleted event. Mock `transition_to_suspended_any` to return `{ success: true }`. Assert duplicate webhook returns `processed:true` via `PRECONDITION_FAILED`.

- [ ] **T7: Tests — unit + ATDD green + pgTAP (AC: 0, 1-6)**
  - [ ] T7.1 Create `apps/web/__tests__/billing/9-5a-lifecycle.spec.ts` (unit scaffold, RED first per AC0):
    - Pure transition tests: all allowed transitions succeed; all disallowed transitions return `{ ok:false, reason }`; `isTerminalStatus` for each status.
    - `mapStripeStatusToDb` tests: every Stripe status input maps correctly; unknown statuses return null.
    - `ReconciliationReportSchema` validation tests.
    - Mocked sweep tests: import `runGraceSweep` / `runSuspensionSweep` from `@flow/agents` (after T4.1 build); mock `createServiceClient` from `@flow/db` returning a fixed workspace list + mock `app_config` reads returning 7/30 — assert correct RPC calls, audit-log writes, and per-row error isolation (EC8).
    - Mocked `runReconciliation`: simulate drift, no-drift, Stripe error (EC9), invalid transition (EC4) — assert report shape.
    - Mocked `reconcileSubscriptionsAction` (the Server Action wrapper): assert it delegates to `runReconciliation` and wraps the result in `ActionResult`.
  - [ ] T7.2 Rewrite `apps/web/__tests__/acceptance/epic-9/9-5a-subscription-lifecycle-state-machine.spec.ts` in GREEN: remove inline stubs and replace with real imports from `@flow/types` (`subscriptionStatusSchema`), `@flow/shared` (`transitionSubscriptionStatus`, `isTerminalStatus`, `SUBSCRIPTION_TRANSITIONS`, `GRACE_PERIOD_DAYS`, `SUSPENSION_MAX_DAYS`), and `@/lib/actions/billing/reconcile-subscriptions` (`reconcileSubscriptionsAction`). The wrapper imports `runReconciliation` from `@flow/agents` — mock `@flow/agents` at the test boundary to keep ATDD focused on contract, not Stripe calls. All 19 ATDD tests must pass. In RED phase, the file must import these real symbols and fail because they do not yet exist.
  - [ ] T7.3 pgTAP (required): create `supabase/tests/rls_subscription_lifecycle.sql` — 8 tests:
    1. `anon` cannot call `transition_workspace_subscription_status`.
    2. `authenticated` member can call `transition_workspace_subscription_status` for their own workspace.
    3. `authenticated` non-member cannot call `transition_workspace_subscription_status` for another workspace.
    4. `service_role` can call `transition_workspace_subscription_status` for any workspace.
    5. `transition_workspace_subscription_status` returns `PRECONDITION_FAILED` when `p_from_status` does not match.
    6. `transition_workspace_subscription_status` returns `INVALID_STATUS` for a disallowed `p_to_status`.
    7. CHECK constraint accepts all 6 statuses.
    8. CHECK constraint rejects an invalid status.
    Run via `psql -f` if Docker mount issue blocks `supabase test db`; record the command used.
  - [ ] T7.4 Run `pnpm typecheck` (0 new errors in 9-5a files), `pnpm lint` (0 new errors), `pnpm test` (all 9-5a tests green + no regressions in webhook handler tests).
  - [ ] T7.5 Manually exercise via `psql` against local Supabase: insert a `past_due` row with `subscription_updated_at = now() - interval '8 days'`, invoke the grace sweep action, assert row flips to `suspended`. Reset.

## Dev Notes

### Architecture Compliance

- **service_role perimeter (project-context.md:150):** Sweeps (T4) and reconciliation (T5) use `createServiceClient()` — they are system cron jobs. The webhook handler (T6) ALREADY uses `createServiceClient()` (route.ts:96) — no change. **NO user-facing Server Action in 9-5a touches subscription status directly** — the existing user actions (`cancelSubscriptionAction`, `reactivateSubscriptionAction`, `changeTierAction`, `syncStripeDataAction`) all delegate to Stripe; the webhook is the source of truth. This is by design (spike §2.1 — Stripe owns billing state, Supabase syncs via webhook).
- **Conditional writes (Epic 8 retro #5, project-context.md:494):** The new `transition_workspace_subscription_status` RPC is the canonical conditional-write primitive. Always pass `p_from_status` — never do an unconditional `UPDATE WHERE id=$1` for lifecycle transitions (the existing `set_workspace_subscription_status` is unconditional and remains for non-lifecycle webhook writes like `invoice.paid` flipping to `active`).
- **Pure helpers in packages, not apps (Epic 8 retro #6):** `SUBSCRIPTION_TRANSITIONS`, `transitionSubscriptionStatus`, `isTerminalStatus`, `mapStripeStatusToDb` go in `packages/shared/src/subscription-lifecycle.ts`. This lets `@flow/agents` (9-5b orchestrator guard) and `apps/web` (reconciliation + webhook) both consume them without an app→app dependency.
- **Idempotency (project-context.md:494):** "already in target state = success, not error". The RPC's `PRECONDITION_FAILED` return is for the *conditional write* guard — callers treat it as "nothing to do" (idempotent success), not as a hard failure. The audit log captures the no-op for traceability.
- **Money/financial pattern (project-context.md:449-455):** No money math in 9-5a — it’s pure state transitions. But the *trigger* is financial (payment failure), so audit logs are non-negotiable (project-context.md:516 — append-only audit trail).
- **Append-only migrations (project-context.md:390):** The migration is additive — `DROP CONSTRAINT` + `ADD CONSTRAINT` in one migration is the documented pattern for CHECK changes; do NOT edit the existing `20260618000001` migration.
- **200-line file limit (project-context.md:336):** All new files ≤200 lines. `reconcile-subscriptions.ts` is the highest-risk — batch iteration + status mapping + audit + report assembly. Extract helpers aggressively. If it crosses 200, split reconciliation into `reconcile-subscriptions.ts` (action shell) + `_reconcile-helpers.ts` (per-workspace logic).
- **Named exports only (project-context.md):** No default exports anywhere in 9-5a.
- **No `any`, no `@ts-ignore`, no `as` casts at row boundaries:** Use Zod schemas (`ReconciliationReportSchema`) for RPC return shapes. Use `maybeSingle()` + null check for single-row reads.

### Cancelled vs Suspended — the key semantic distinction

The existing codebase has `cancelled` as a status (set by 9-3b when the owner cancels-at-period-end via Stripe Customer Portal, via `customer.subscription.updated` with `cancel_at_period_end=true` or via `customer.subscription.deleted`). FR59 introduces a parallel lifecycle for *payment failures*: `active → past_due (7d grace) → suspended (30d) → deleted`. The two flows are distinct:

- **`cancelled`** — owner intent. They chose to cancel. Stripe subscription is still alive until period end. Workspace is fully read-write until period end, then transitions to suspended (via the `customer.subscription.deleted` event in AC5).
- **`suspended`** — system-imposed. Payment failed and grace expired (or subscription deleted by Stripe). Workspace is read-only for 30 days (per FR59 + project-context.md:498) — but the read-only enforcement itself is 9-5b's job (orchestrator guard + write blocking). 9-5a only sets the status.

This is why `subscriptionLifecycleStatusSchema` excludes `cancelled` — the pure state machine (AC2) models the FR59 failure lifecycle. `cancelled` is a meta-state orthogonal to the lifecycle; it’s an input signal that may eventually transition INTO the lifecycle when the period actually ends.

**Open decision for Architect/PM (non-blocking):** should `unpaid` and `incomplete_expired` Stripe statuses (currently mapped to `cancelled` in subscription-updated.ts:43-50) instead map directly to `suspended`? Default: NO — `cancelled` is the correct semantic (the subscription is dead, period end already passed). The `customer.subscription.deleted` event will fire shortly after and transition `cancelled → suspended`. If the team prefers faster suspension, the mapping is a 2-line change. Flag as a Deferred Item if not addressed in 9-5a.

### Reuse map (do NOT reinvent)

| Existing asset | Where | 9-5a use |
|---|---|---|
| `getTierConfig()` | `apps/web/lib/config/tier-config.ts` | NOT used by sweep/reconcile (those read `app_config` directly via `createServiceClient` in `packages/agents/`, avoiding a packages→apps dependency). Listed here only to document that the two config keys (`subscription_grace_period_days`, `subscription_suspension_period_days`) ALREADY exist and are exposed via `.windows` for any future user-facing UI that needs them. |
| `createServiceClient()` | `@flow/db` | System-level client for sweeps + reconciliation + webhook. |
| `getPaymentProvider('stripe').getSubscription(id)` | `@flow/agents/providers` | Reconciliation calls this per workspace. Returns `{ status, customerId, priceId, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, providerSubscriptionId }`. |
| `writeAuditLog({ workspaceId, agentId, action, entityType, details })` | `packages/agents/shared/audit-writer` | Every transition, every reconciliation correction, every uncorrectable case. |
| `processStripeEvent` dispatcher | `apps/web/lib/stripe/handlers/index.ts` | NO new event types. `customer.subscription.deleted` already routes to `handleSubscriptionDeleted`. |
| `mapSubscriptionStatus` (private in subscription-updated.ts:34-52) | currently inline | **Extract to `packages/shared/src/subscription-lifecycle.ts` as `mapStripeStatusToDb`** so reconcile-subscriptions.ts reuses it (DRY). Update subscription-updated.ts to import the shared version. |
| `set_workspace_subscription_status` RPC | migration L167 | UNCONDITIONAL status write — keep as-is for the `invoice.paid → active` recovery path (existing handleInvoicePaid uses it). The new conditional RPC is for transitions only. |
| `upsert_workspace_subscription` RPC | migration L83 | Unconditional upsert from `customer.subscription.updated` + checkout. Keep as-is, extend allowlist. |
| `cacheTag('workspace', wsId)` + `revalidateTag` | `@flow/db` + `next/cache` | Call after every sweep/reconcile transition so the billing page UI refreshes on next load. |
| `_helpers.ts` (`toFailure`, `withTenantContext`, `requireOwner`) | `apps/web/lib/actions/billing/_helpers.ts` | NOT used by sweeps/reconcile (those are system-level, no tenant context). Reused only if a user-facing wrapper is added (not in 9-5a scope). |
| `PgBossProducer` / `PgBossWorker` + scheduler | `packages/agents/orchestrator/` | 9-5a extends `SCHEDULES` only — the worker dispatch on `data.trigger` may need a switch arm. Inspect `pg-boss-worker.ts` to find the dispatcher. |
| `subscriptionStatusSchema`, `subscriptionTierSchema` | `packages/types/src/subscription.ts` | Extend status enum (T2.1). Tier schema unchanged. |

### Project Structure Notes

```
apps/web/
  lib/actions/billing/
    reconcile-subscriptions.ts                      # NEW (T5.2) — thin Server Action wrapper for admin invocation
    _helpers.ts                                     # UNCHANGED (reference for ActionResult pattern)
  lib/stripe/handlers/
    subscription-updated.ts                         # MODIFY (T6) — handleSubscriptionDeleted → suspended; extract mapSubscriptionStatus
  app/api/webhooks/stripe/
    route.ts                                        # UNCHANGED (existing dispatcher is sufficient)
    __tests__/route.test.ts                         # MODIFY (T6.3) — assert suspended target on deleted event
  __tests__/billing/
    9-5a-lifecycle.spec.ts                          # NEW (T7.1) — unit tests EC1–EC13
  __tests__/acceptance/epic-9/
    9-5a-subscription-lifecycle-state-machine.spec.ts   # GREEN (T7.2) — rewrite 19 tests with real imports

packages/
  shared/src/
    subscription-lifecycle.ts                       # NEW (T2.2) — pure helpers + mapStripeStatusToDb (extracted from subscription-updated.ts)
    index.ts                                        # MODIFY (T2.3) — re-export subscription-lifecycle
  types/src/
    subscription.ts                                 # MODIFY (T2.1) — extend enum + add lifecycle + ReconciliationReport schemas
    index.ts                                        # MODIFY — re-export new schemas
  agents/orchestrator/
    scheduler.ts                                    # MODIFY (T3.1) — append 3 schedule entries
    lifecycle-sweep.ts                              # NEW (T4.1) — runGraceSweep + runSuspensionSweep (core logic, no Next.js deps)
    reconcile-subscriptions.ts                      # NEW (T5.1) — runReconciliation (core logic, no Next.js deps)
    lifecycle-sweep-worker.ts                       # NEW (T4.2) — registerLifecycleSweepWorkers(boss) + LifecycleTriggerPayload type
    factory.ts                                      # MODIFY (T4.3) — call registerLifecycleSweepWorkers after registerSweepWorkers (L94)

supabase/migrations/
  20260619000001_subscription_lifecycle_states.sql  # NEW (T1.1) — CHECK extension + RPC replaces + new conditional-write RPC
supabase/tests/
  rls_subscription_lifecycle.sql                    # NEW required (T7.3) — RPC access tests
```

No barrel files inside feature folders (project-context.md). No new tables — `workspaces` is extended in place via CHECK constraint. The new RPC lives in the same migration as the CHECK change (project-context.md:410 — RPC + type changes ship together).

**Critical dependency-direction note:** The sweep + reconcile **business logic** lives in `packages/agents/orchestrator/` (T4.1, T5.1), NOT in `apps/web/lib/actions/`. This is because the orchestrator worker (`packages/agents/`) is the primary invoker (nightly cron via pg-boss). Apps cannot be imported from packages (eslint-plugin-import no-restricted-paths — project-context.md:185-189). The Server Action in `apps/web/lib/actions/billing/reconcile-subscriptions.ts` (T5.2) is a thin wrapper that imports `runReconciliation` from `@flow/agents` (correct direction: apps → packages) for admin-UI invocation. The `@flow/agents` package exports `runReconciliation`, `runGraceSweep`, `runSuspensionSweep`, and `registerLifecycleSweepWorkers` through its package-boundary barrel; internal agent modules remain isolated.

### Testing Requirements

- **Vitest (unit, RED first per AC0):** `apps/web/__tests__/billing/9-5a-lifecycle.spec.ts` — EC1–EC13 coverage. Pure transition map exhaustively tested (every allowed + every disallowed transition, including `cancelled` boundaries). `mapStripeStatusToDb` for every Stripe status enum value (`active`, `trialing`, `canceled`, `past_due`, `unpaid`, `incomplete_expired`, `incomplete`, unknown). `ReconciliationReportSchema` parse + safeParse. Mock-based sweep tests (mock `createServiceClient` chained returns + `app_config` reads returning 7/30 + `writeAuditLog` + `transition_workspace_subscription_status`) asserting: correct query, correct threshold, per-row error isolation (EC8), `PRECONDITION_FAILED` counted as swept without duplicate audit log, audit log per true transition, summary return shape. Mock-based `runReconciliation` tests: drift case, no-drift case, `deleted` rows excluded, Stripe error (EC9), invalid transition (EC4), `PRECONDITION_FAILED` (EC1/EC3), timeout handling. Mock-based `reconcileSubscriptionsAction` wrapper: assert it delegates to `runReconciliation` and wraps the result in `ActionResult`. Aim for 35+ unit tests.
- **Vitest (ATDD):** `9-5a-subscription-lifecycle-state-machine.spec.ts` — rewrite the 19 tests so they import real symbols from `@flow/types`, `@flow/shared`, and `@/lib/actions/billing/reconcile-subscriptions`. The file must be RED before implementation (imports fail) and green after. Update `vi.mock` paths: mock `@flow/agents` (for `runReconciliation`) and `@flow/db`/`next/cache` as needed; remove `vi.mock('@/lib/supabase-server')` since the action does not use it.
- **pgTAP (required, T7.3):** `supabase/tests/rls_subscription_lifecycle.sql` — 8 tests covering `anon` rejection, `authenticated` owner/non-owner scoping, `service_role` success, `PRECONDITION_FAILED`, `INVALID_STATUS`, CHECK allowlist acceptance/rejection.
- **Manual smoke (T7.5):** `psql` exercise against local Supabase — insert a backdated `past_due` row, invoke the sweep, assert transition. Same for `suspended` row. This is the only way to validate the conditional-write semantics end-to-end without a full Stripe test-mode flow.
- **E2E (deferred):** Full Stripe test-mode payment-failure flow is a 9-5b/Epic-close concern (requires test cards `4000 0000 0000 0002` decline + `stripe listen` forwarding). Document if performed; do not block 9-5a `done` on it.
- **Regression check:** Run the existing webhook handler tests (`apps/web/app/api/webhooks/stripe/__tests__/route.test.ts` + any handler-specific tests in `apps/web/lib/stripe/handlers/__tests__/`) — they must remain green after T6 changes.

### Environment Prerequisites

- `supabase start` running locally (project-context.md:378). Migration `20260619000001` applies via `supabase db reset` or `supabase migration up`.
- `app_config` already seeded by 9-3a migration `20260618000002` — `subscription_grace_period_days=7`, `subscription_suspension_period_days=30`. Verify via `psql -c "SELECT key, value FROM app_config WHERE key LIKE 'subscription_%';"` after `supabase db reset` (should already be present).
- `getTierConfig()` already reads both keys and exposes them via `.windows` (tier-config.ts L72-97) — NO type extension needed, NO new code in tier-config.ts.
- `STRIPE_SECRET_KEY` set in `.env.local` — reconciliation calls Stripe. Unit tests mock the provider; only manual smoke (T7.5) needs the real key.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.5] — story statement + ACs (L1577-1590)
- [Source: _bmad-output/planning-artifacts/prd.md#L1273-1274] — FR59 (lifecycle), FR60 (agent pause) exact text
- [Source: _bmad-output/planning-artifacts/prd.md#L1271] — FR57 (downgrade data preservation — 9-5b)
- [Source: _bmad-output/planning-artifacts/prd.md#L1247] — FR42 (exactly-once webhook processing)
- [Source: _bmad-output/planning-artifacts/prd.md#L1452] — NFR46 (Stripe webhook retry — informs idempotency)
- [Source: _bmad-output/planning-artifacts/prd.md#L1466] — NFR54 (reconciliation window — informs AC6)
- [Source: _bmad-output/planning-artifacts/epic-9-planning-review.md#§6] 9.5 split rationale → 9-5a (state machine) + 9-5b (agent pause/downgrade)
- [Source: _bmad-output/planning-artifacts/epic-9-planning-review.md#§8.2] 9-5a test plan (P0): state-machine transitions, grace period, reconciliation
- [Source: _bmad-output/planning-artifacts/epic-9-planning-review.md#§11] critical path: 9-4 → 9-5a → {9-5b, 9-6, 9-7}
- [Source: _bmad-output/planning-artifacts/stripe-subscription-spike.md#§3.1-3.3] schema additions, dedup, app_config seed keys
- [Source: _bmad-output/planning-artifacts/stripe-subscription-spike.md#§6.1] state-machine mapping to Stripe statuses
- [Source: _bmad-output/planning-artifacts/stripe-subscription-spike.md#§9.1] split-brain risk + nightly reconciliation mitigation
- [Source: _bmad-output/planning-artifacts/stripe-subscription-spike.md#§9.2 Q6] custom dunning vs Stripe Smart Retries — we control the 7d/30d timeline explicitly
- [Source: _bmad-output/implementation-artifacts/9-4-subscription-tiers-tier-limits.md] previous story — `enforceTierLimit` reads `subscription_status` but does not branch on it (note in 9-4 dev notes EC10: "status-based behavior is 9-5a/9-5b's concern")
- [Source: _bmad-output/implementation-artifacts/9-3a-stripe-webhook-infrastructure.md] webhook + RPC + migration origin
- [Source: docs/project-context.md#L150] service_role perimeter
- [Source: docs/project-context.md#L494] idempotent webhook + "already in target state = success"
- [Source: docs/project-context.md#L498-502] billing state machine rules (7d grace, 30d suspension, GDPR cascade deferred)
- [Source: docs/project-context.md#L336-338] file/function size limits
- [Source: docs/project-context.md#L388-396] migration rules (append-only, idempotent, tested down)
- [Source: docs/project-context.md#L410] RPC + TypeScript types ship together
- `apps/web/lib/config/tier-config.ts` — ALREADY reads grace/suspension days via `.windows`; verify before use, do NOT modify (consume `(await getTierConfig()).windows.grace_period_days`)
- [Source: packages/types/src/subscription.ts#L12-14] explicit comment reserving `suspended`/`deleted` for 9-5a
- [Source: supabase/migrations/20260618000001_workspace_subscription_columns.sql#L19-22] current CHECK constraint to extend
- [Source: supabase/migrations/20260618000001_workspace_subscription_columns.sql#L114] `upsert_workspace_subscription` allowlist
- [Source: supabase/migrations/20260618000001_workspace_subscription_columns.sql#L190] `set_workspace_subscription_status` allowlist
- [Source: apps/web/lib/stripe/handlers/subscription-updated.ts#L129-161] `handleSubscriptionDeleted` — modify per AC5
- [Source: apps/web/lib/stripe/handlers/subscription-updated.ts#L34-52] `mapSubscriptionStatus` — extract to shared
- [Source: apps/web/lib/stripe/handlers/index.ts#L8-32] dispatcher — NO new event types needed
- [Source: apps/web/lib/actions/billing/sync-stripe-data.ts] existing user-scoped sync action pattern (reference; 9-5a reconcile is system-level)
- [Source: packages/agents/orchestrator/scheduler.ts#L10-52] SCHEDULES array — append-only pattern
- [Source: packages/agents/orchestrator/scheduler.ts#L54-76] registerSchedules failure-collection pattern
- [Source: packages/agents/orchestrator/sweep-worker.ts#L66] `registerSweepWorkers(boss, trustClient)` — registration entry-point pattern to mirror
- [Source: packages/agents/orchestrator/sweep-worker.ts#L121-143] cleanup-expired-stripe-events handler — minimal system-level sweep pattern to model the new handlers on
- [Source: packages/agents/orchestrator/sweep-worker.ts#L527,651,701] dynamic-import pattern for per-trigger executors
- [Source: packages/agents/orchestrator/factory.ts#L86-94] orchestrator entry point — where to add the third registration call
- [Source: packages/agents/shared/audit-writer] writeAuditLog signature
- [Source: apps/web/__tests__/acceptance/epic-9/9-5b-agent-pause-downgrade-handling.spec.ts#L31-33] 9-5b consumes `shouldDequeueForWorkspace(status)` — must return false for `suspended` and `deleted`; 9-5a MUST make these valid DB statuses first

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Deferred Items (at close)

_Count recorded at each code review pass. If >5, require Architect + PM approval (see scope-check-gate.md step 7)._

Pre-known candidates (decide during dev whether to defer or address in 9-5a):
1. **`unpaid` / `incomplete_expired` → `suspended` mapping** (EC13) — current code maps these to `cancelled`. Default: leave alone; `customer.subscription.deleted` will fire and transition `cancelled → suspended`. Flag as deferred if not changed.
2. **Hard-delete + GDPR cascade** — `deleted` is a soft marker in 9-5a. Actual row deletion + PII 30d / financial 7y / audit hash-chain preservation is story 10-5 (`data-export-audit-trail-gdpr-compliance`). 9-5a does NOT delete rows.
3. **Reconciliation batch tuning** — default batch size 100 workspaces. Tune based on Stripe API rate limits + Vercel function timeout. Deferred to 9-7 (billing-accuracy-usage-visibility) if profiling shows problems.
4. **Per-workspace notification at 25-day-suspended mark** ("approaching deletion" warning) — 9-5b owns the notification surface; 9-5a writes the audit row that 9-5b will surface.
5. **`subscription_cancel_at_period_end=true` while still `active`** — workspace is fully read-write until period end (spike §6.1). 9-5a does not gate writes on the cancel flag. Tier-limit enforcement (9-4) and agent guard (9-5b) also do not gate on it. If we need pre-emptive gating, that is a separate story.

### Test Commit Record

_Epic 5 retro A2: Record the SHA of the first failing test commit (red phase) before any implementation commit. This makes AC0 test-first auditable._

| Test File | First Red Commit SHA | Date |
|-----------|---------------------|------|
| apps/web/__tests__/acceptance/epic-9/9-5a-subscription-lifecycle-state-machine.spec.ts | (existing RED scaffold, 2026-06-15) | 2026-06-15 |
| apps/web/__tests__/billing/9-5a-lifecycle.spec.ts | _(to record at AC0 RED commit)_ | _(today)_ |

### File List

_New files (planned):_
- `supabase/migrations/20260619000001_subscription_lifecycle_states.sql` — CHECK extension + 2 RPC replaces + 1 new conditional-write RPC
- `packages/shared/src/subscription-lifecycle.ts` — `SUBSCRIPTION_TRANSITIONS`, `transitionSubscriptionStatus`, `isTerminalStatus`, `mapStripeStatusToDb` (extracted), default constants
- `packages/agents/orchestrator/lifecycle-sweep.ts` — `runGraceSweep`, `runSuspensionSweep` (core business logic, no Next.js deps)
- `packages/agents/orchestrator/reconcile-subscriptions.ts` — `runReconciliation` (core business logic, no Next.js deps)
- `packages/agents/orchestrator/lifecycle-sweep-worker.ts` — `registerLifecycleSweepWorkers(boss)` + `LifecycleTriggerPayload` type
- `apps/web/lib/actions/billing/reconcile-subscriptions.ts` — thin Server Action wrapper for admin invocation (delegates to `@flow/agents`)
- `apps/web/__tests__/billing/9-5a-lifecycle.spec.ts` — unit tests EC1–EC13
- `supabase/tests/rls_subscription_lifecycle.sql` — optional pgTAP (P1)

_Modified files (planned):_
- `packages/types/src/subscription.ts` — extend `subscriptionStatusSchema`; add `subscriptionLifecycleStatusSchema`, `ReconciliationReportSchema`
- `packages/types/src/index.ts` — re-export new schemas
- `packages/shared/src/index.ts` — re-export `subscription-lifecycle.ts`
- `packages/agents/orchestrator/scheduler.ts` — append 3 schedule entries
- `packages/agents/orchestrator/factory.ts` — call `registerLifecycleSweepWorkers(boss)` after L94
- `packages/agents/orchestrator/sweep-worker.ts` — UNCHANGED (already 728 lines; new handlers go in sibling file)
- `apps/web/lib/stripe/handlers/subscription-updated.ts` — extract `mapSubscriptionStatus` to shared; modify `handleSubscriptionDeleted` per AC5
- `apps/web/__tests__/acceptance/epic-9/9-5a-subscription-lifecycle-state-machine.spec.ts` — GREEN: rewrite 19 tests with real imports
- `apps/web/app/api/webhooks/stripe/__tests__/route.test.ts` (or sibling handler test) — assert new `suspended` target on deleted event

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-06-18 | Story created from epics.md#9.5 + epic-9-planning-review.md#§6 split + stripe-subscription-spike.md | bmad-create-story (glm-5.2) |
