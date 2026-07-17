/**
 * Subscription state helpers (Story 9.5b — FR60).
 *
 * Pure helpers for deciding whether agent execution may proceed for a given
 * subscription status. The orchestrator (PgBossWorker.claim) consumes
 * `shouldDequeueForWorkspace` to short-circuit job claims on non-active
 * workspaces, releasing them back to the queue via `boss.fail(retryable)`.
 *
 * Conventions:
 * - All helpers are PURE (no I/O, no side effects).
 * - Re-exports the `SubscriptionStatus` union from `@flow/types` so callers
 *   have a single source of truth (the DB CHECK constraint at
 *   `20260619000001_subscription_lifecycle_states.sql`).
 * - Status semantics (FR60):
 *   - `active`, `free`         → agent execution proceeds
 *   - `past_due`, `suspended`  → paused (payment issue / read-only window)
 *   - `deleted`, `cancelled`   → blocked (terminal / owner-cancelled)
 *
 * NOTE (revision 2026-06-18): the previous ATDD scaffold accepted a bare
 * `string` here — that contradicts strict mode (no implicit `any` narrowing).
 * The union is required internally; callers must pass a typed value (the
 * orchestrator fetches `subscription_status` from the typed `workspaces` row).
 */
import type { SubscriptionStatus } from '@flow/types';

export type { SubscriptionStatus };

/**
 * Returns true when agent execution is permitted for the given subscription
 * status. `active` and `free` are the only dequeuing statuses.
 *
 * Pure — does not consult the database. Caller is responsible for fetching
 * `workspace.subscription_status` via `getWorkspaceSubscriptionStatus()`.
 */
export function shouldDequeueForWorkspace(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'free';
}

/**
 * Set of statuses that pause agent execution. Exported for test/guard
 * symmetry — do NOT use this to gate non-orchestrator surfaces (UI banners
 * consume `subscription_status` directly).
 */
export const PAUSED_STATUSES: ReadonlySet<SubscriptionStatus> = Object.freeze(
  new Set<SubscriptionStatus>([
    'past_due',
    'suspended',
    'cancelled',
    'deleted',
  ]),
);

/**
 * Convenience inverse of `shouldDequeueForWorkspace` for surfaces that need
 * "is this workspace paused?" semantics.
 */
export function isPausedStatus(status: SubscriptionStatus): boolean {
  return PAUSED_STATUSES.has(status);
}
