/**
 * Tier-limit pure helpers (Story 9.4 — AC2, FR56).
 *
 * Pure (no DB, no side-effects). Lives in `packages/shared` so both 9-4
 * (`enforceTierLimit`) and 9-5b (agent-pause downgrade handling) can import
 * them without an app→app dependency.
 *
 * Semantics:
 *  - `APPROACH_THRESHOLD_PERCENT = 0.8` — UI amber badge fires at ≥80%.
 *  - `checkTierLimit({ current, adding, limit })`:
 *      • `allowed: false` when `current + adding > limit` (hard block).
 *      • `allowed: true` plus `warning: 'Approaching limit'` when
 *        `current >= ceil(limit * 0.8)` (proactive notice — FR56).
 *      • `allowed: true` no warning otherwise.
 *
 * Unlimited handling: callers normalize `null` (Agency) to
 * `Number.MAX_SAFE_INTEGER` upstream (`getTierLimits`), so this helper
 * never has to special-case unlimited — `current + adding` will always be
 * far below MAX_SAFE_INTEGER. EC1 verifies this invariant.
 */

export const APPROACH_THRESHOLD_PERCENT = 0.8 as const;

export const APPROACH_LIMIT_WARNING = 'Approaching limit' as const;

export interface CheckTierLimitInput {
  /** Current usage count (e.g., active clients). */
  current: number;
  /** How many resources the operation will add (defaults to 1 upstream). */
  adding: number;
  /** Hard ceiling; use Number.MAX_SAFE_INTEGER for "unlimited". */
  limit: number;
}

export interface CheckTierLimitResult {
  allowed: boolean;
  warning?: typeof APPROACH_LIMIT_WARNING;
}

/**
 * Pure tier-limit decision. Returns `{ allowed: false }` for over-limit
 * operations, `{ allowed: true, warning }` when usage is at/above the 80%
 * threshold, or `{ allowed: true }` otherwise.
 */
export function checkTierLimit(input: CheckTierLimitInput): CheckTierLimitResult {
  const { current, adding, limit } = input;
  const projected = current + adding;
  if (projected > limit) {
    return { allowed: false };
  }
  const atThreshold = current >= Math.ceil(limit * APPROACH_THRESHOLD_PERCENT);
  return atThreshold ? { allowed: true, warning: APPROACH_LIMIT_WARNING } : { allowed: true };
}
