/**
 * Internal helpers for the billing Server Actions (Story 9.3b).
 *
 * Not a Server Action file itself — synchronous and async utilities consumed by
 * the `'use server'` modules in this folder. Keeps each action file under the
 * 200-line soft limit and centralizes the owner guard, rate-limit, workspace
 * fetch, and price-resolution logic shared across checkout / portal / sync.
 */
import { getTierConfig } from '@/lib/config/tier-config';
import { createFlowError, requireTenantContext } from '@flow/db';
import type { FlowErrorBase } from '@flow/types';
import type { ActionResult } from '@flow/types';
import type { TierConfig } from '@/lib/config/tier-config';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantContext } from '@flow/db';
import { isRateLimited } from '@/lib/actions/portal/helpers';

export interface WorkspaceBilling {
  id: string;
  name: string;
  subscription_status: string;
  subscription_tier: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_current_period_start: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
}

const BILLING_COLUMNS =
  'id, name, subscription_status, subscription_tier, stripe_customer_id, stripe_subscription_id, subscription_current_period_start, subscription_current_period_end, subscription_cancel_at_period_end';

/** Wrap a FlowError into the ActionResult failure shape. */
export function toFailure<T>(error: FlowErrorBase): ActionResult<T> {
  return { success: false, error };
}

/** Returns a FORBIDDEN FlowError if the caller is not the workspace owner, else null. */
export function requireOwner(ctx: TenantContext): FlowErrorBase | null {
  if (ctx.role !== 'owner') {
    return createFlowError(403, 'FORBIDDEN', 'Only owners can manage billing.', 'auth');
  }
  return null;
}

/**
 * Best-effort per-workspace rate limit. Mirrors the portal `check_rate_limit`
 * pattern: fail OPEN on unexpected shapes (project-context.md:114). Returns
 * a RATE_LIMITED FlowError when the limit is hit, otherwise null.
 */
export async function checkBillingRateLimit(
  supabase: SupabaseClient,
  workspaceId: string,
  action: 'checkout' | 'portal',
): Promise<FlowErrorBase | null> {
  const { data: rlResult } = await supabase.rpc('check_rate_limit', {
    p_identifier: `billing:${action}:${workspaceId}`,
    p_action: `billing_${action}`,
    p_max_requests: 10,
    p_window_seconds: 60,
    p_min_interval_seconds: 0,
  });
  const rl = isRateLimited(rlResult);
  if (rl.limited) {
    return createFlowError(
      429,
      'RATE_LIMITED',
      'Too many billing requests. Try again later.',
      'auth',
      { retryAfterMs: rl.retryAfterMs },
    );
  }
  return null;
}

/** Read the subscription-relevant columns of the workspace row. */
export async function fetchWorkspaceForBilling(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceBilling | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select(BILLING_COLUMNS)
    .eq('id', workspaceId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as WorkspaceBilling;
}

/**
 * Resolve the Stripe priceId for a (tier, interval) pair via `getTierConfig()`.
 *
 * `getTierConfig()` THROWS when the `stripe_prices` app_config still contains
 * `price_placeholder_*` sentinels — we wrap that into SYSTEM_CONFIG_MISSING so
 * the action never leaks a raw throw to the client (EC3).
 *
 * Only `pro_monthly` and `agency_monthly` are seeded today; yearly prices and
 * other tiers are deferred to 9-4.
 */
export async function resolvePriceId(
  tier: 'pro' | 'agency',
  interval: 'monthly' | 'yearly',
): Promise<string> {
  let config: TierConfig;
  try {
    config = await getTierConfig();
  } catch {
    throw createFlowError(
      400,
      'SYSTEM_CONFIG_MISSING',
      'Selected plan is not available.',
      'system',
    );
  }
  const key = `${tier}_${interval}` as keyof TierConfig['stripePrices'];
  const priceId = config.stripePrices[key];
  if (!priceId) {
    throw createFlowError(
      400,
      'SYSTEM_CONFIG_MISSING',
      'Selected plan is not available.',
      'system',
    );
  }
  return priceId;
}

/**
 * Capture `requireTenantContext` failures (which throw FlowErrorBase) into the
 * ActionResult failure shape. Lets actions use a terse `try/catch` around the
 * context lookup without repeating the mapping boilerplate.
 */
export async function withTenantContext<T>(
  supabase: SupabaseClient,
  fn: (ctx: TenantContext) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  let ctx: TenantContext;
  try {
    ctx = await requireTenantContext(supabase);
  } catch (err) {
    return toFailure(err as FlowErrorBase);
  }
  return fn(ctx);
}
