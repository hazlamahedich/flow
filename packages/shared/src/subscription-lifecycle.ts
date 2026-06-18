/**
 * Subscription lifecycle pure helpers (Story 9.5a — FR59).
 *
 * Conventions:
 * - All helpers are PURE (no I/O, no side effects) and unit-testable in isolation.
 * - `SUBSCRIPTION_TRANSITIONS` includes `cancelled` because `active → cancelled`
 *   (owner-scheduled cancel-at-period-end) and `cancelled → suspended` (period
 *   ends, Stripe fires `customer.subscription.deleted`) are valid transitions.
 * - `GRACE_PERIOD_DAYS` / `SUSPENSION_MAX_DAYS` are fallback constants used by
 *   unit tests + schema defaults. Runtime values come from `app_config` in
 *   sweeps and from `getTierConfig().windows` in UI.
 */
import type { SubscriptionStatus } from '@flow/types';

export type { SubscriptionStatus } from '@flow/types';

/**
 * Allowed lifecycle transitions. Keyed by `from` status; value is the list of
 * `to` statuses that may follow. Anything not listed is rejected by
 * `transitionSubscriptionStatus`.
 *
 * Failure lifecycle (FR59): active → past_due → suspended → deleted.
 * Reactivation: past_due → active, suspended → active.
 * Owner intent: active → cancelled (cancel-at-period-end).
 * Period-end: cancelled → suspended (when Stripe fires `.deleted`).
 * Direct deletion path: active → suspended (subscription deleted before grace).
 */
export const SUBSCRIPTION_TRANSITIONS: Readonly<
  Record<SubscriptionStatus, ReadonlyArray<SubscriptionStatus>>
> = {
  free: Object.freeze(['active']),
  active: Object.freeze(['past_due', 'suspended', 'cancelled']),
  past_due: Object.freeze(['suspended', 'active']),
  cancelled: Object.freeze(['suspended']),
  suspended: Object.freeze(['deleted', 'active']),
  deleted: Object.freeze([]),
};

/**
 * Validates a lifecycle transition against the allowlist. Pure — no I/O.
 * Returns `{ ok: true }` on success, or `{ ok: false, reason }` describing
 * the invalid transition. The reason string format is stable for test
 * assertions: `invalid_transition: <from>→<to>`.
 */
export function transitionSubscriptionStatus(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): { ok: true } | { ok: false; reason: string } {
  const allowed = SUBSCRIPTION_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    return { ok: false, reason: `invalid_transition: ${from}→${to}` };
  }
  return { ok: true };
}

/**
 * Type guard — `deleted` is the only terminal lifecycle status. Once a
 * workspace is `deleted`, no further transitions are permitted.
 */
export function isTerminalStatus(status: SubscriptionStatus): status is 'deleted' {
  return status === 'deleted';
}

/**
 * Maps a Stripe subscription status string to our DB status enum.
 *
 * - `active`, `trialing` → `active` (trial users can use the product)
 * - `past_due` → `past_due` (enters the 7-day grace window)
 * - `canceled` (Stripe US spelling) → `cancelled` (DB uk spelling; owner-scheduled
 *   cancel-at-period-end — subscription is still alive until period end)
 * - `unpaid`, `incomplete_expired` → `suspended` (terminal payment-failure states
 *   with no owner intent — read-only entry per FR59 + AC5 EC13)
 * - `suspended`, `deleted` → identity (defensive — Stripe's Subscription
 *   interface does not list these as statuses, but if they appear we map them
 *   directly so reconciliation can validate the transition rather than silently
 *   dropping it)
 * - `incomplete` → `null` (transient — Stripe is still attempting payment; no
 *   DB transition yet)
 * - unknown values → `null` (defensive — caller decides whether to ignore)
 *
 * Extracted from `apps/web/lib/stripe/handlers/subscription-updated.ts` so
 * reconciliation can reuse it (DRY — spike §6.1).
 */
export function mapStripeStatusToDb(stripeStatus: string): SubscriptionStatus | null {
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active';
  if (stripeStatus === 'past_due') return 'past_due';
  if (stripeStatus === 'canceled') return 'cancelled';
  if (stripeStatus === 'unpaid' || stripeStatus === 'incomplete_expired') return 'suspended';
  if (stripeStatus === 'suspended' || stripeStatus === 'deleted') return stripeStatus;
  return null;
}

/**
 * Default grace / suspension windows. Seeded in `app_config` by 9-3a migration
 * `20260618000002_app_config_tier_seeding.sql` (grace=7, suspension=30).
 * Sweeps read `app_config` directly via `createServiceClient`; UI reads
 * `getTierConfig().windows`. These constants are fallbacks for unit tests.
 */
export const GRACE_PERIOD_DAYS = 7;
export const SUSPENSION_MAX_DAYS = 30;
