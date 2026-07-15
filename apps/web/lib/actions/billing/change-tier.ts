/**
 * changeTierAction — prorated tier upgrade (Story 9.4 AC4 — FR62).
 *
 * Thin semantic wrapper around `createCheckoutSessionAction` (9-3b). Exists
 * to make FR62 ("prorated on a per-transition basis") an explicit, testable
 * contract rather than to duplicate checkout logic.
 *
 * Behavior:
 *  - Validates `changeTierSchema` (`targetTier: pro|agency`). EC7: downgrade
 *    to Free is rejected at the schema level — that flow is cancel-at-period-
 *    end, owned by 9-5a/FR57.
 *  - Owner-gated via `requireTenantContext`.
 *  - Rejects same-tier transitions with `INVALID_STATE` 409 (EC6).
 *  - Delegates to `createCheckoutSessionAction({ tier, interval: 'monthly' })`
 *    so Stripe applies default proration (spike §9.1: "Use Stripe's default
 *    proration behavior. Don't override. Let Stripe calculate."). EC8.
 *  - Maps 9-3b's `url` → `checkoutUrl` per the ATDD contract.
 *  - Propagates `SYSTEM_CONFIG_MISSING` / `STRIPE_ERROR` from 9-3b.
 *
 * Upgrade is ALWAYS allowed regardless of current usage (EC4 — spike §9.2
 * Q3): the new limit applies once the webhook sets `subscription_tier`.
 */
'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { createFlowError, requireTenantContext } from '@flow/db';
import { changeTierSchema } from '@flow/types';
import type { ActionResult, SubscriptionTier } from '@flow/types';
import { createCheckoutSessionAction } from './create-checkout-session';

interface WorkspaceCurrentTier {
  subscription_tier: SubscriptionTier;
}

async function readCurrentTier(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  workspaceId: string,
): Promise<SubscriptionTier | null> {
  const { data } = await supabase
    .from('workspaces')
    .select('subscription_tier')
    .eq('id', workspaceId)
    .maybeSingle();
  if (!data) return null;
  return (data as WorkspaceCurrentTier).subscription_tier;
}

export async function changeTierAction(
  input: unknown,
): Promise<ActionResult<{ checkoutUrl: string }>> {
  const parsed = changeTierSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid tier change request.',
        'validation',
      ),
    };
  }
  const { targetTier } = parsed.data;

  let ctx;
  let supabase;
  try {
    supabase = await getServerSupabase();
    ctx = await requireTenantContext(supabase);
  } catch (err) {
    return {
      success: false,
      error: err as ReturnType<typeof createFlowError>,
    };
  }

  if (ctx.role !== 'owner') {
    return {
      success: false,
      error: createFlowError(
        403,
        'FORBIDDEN',
        'Only owners can change the subscription tier.',
        'auth',
      ),
    };
  }

  const currentTier = await readCurrentTier(supabase, ctx.workspaceId);
  if (!currentTier) {
    return {
      success: false,
      error: createFlowError(
        404,
        'WORKSPACE_NOT_FOUND',
        'Workspace not found.',
        'validation',
      ),
    };
  }

  // EC6: same-tier transition is a no-op — reject with INVALID_STATE 409.
  if (targetTier === currentTier) {
    return {
      success: false,
      error: createFlowError(
        409,
        'INVALID_STATE',
        'You are already on this tier.',
        'validation',
      ),
    };
  }

  // Delegate to 9-3b — Stripe applies default proration. Do NOT recompute
  // locally (spike §9.1). Propagate any checkout failure as-is.
  const checkout = await createCheckoutSessionAction({
    tier: targetTier,
    interval: 'monthly',
  });
  if (!checkout.success) {
    return checkout;
  }

  return { success: true, data: { checkoutUrl: checkout.data.url } };
}
