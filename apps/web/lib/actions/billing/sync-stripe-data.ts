/**
 * syncStripeDataAction — success-redirect split-brain fallback (Story 9.3b, AC4 — FR42).
 *
 * Called from the billing page on `?sync=1` (the Stripe Checkout success
 * redirect). It is the synchronous fallback for webhook delivery delay or
 * failure: it reads the workspace's Stripe state and upserts it locally so
 * the page does not rely solely on the webhook.
 *
 * Idempotent: `upsert_workspace_subscription` is keyed on
 * `stripe_subscription_id`; the webhook remains the source of truth and a
 * late webhook delivery is a no-op (project-context.md:494 — "already in
 * target state" = success).
 *
 * Best-effort: always returns `{ success: true, data: { synced: true } }`
 * after the owner check. Errors are logged but never surface to the page —
 * the page simply renders the current local state and the next page load
 * reflects the webhook's eventual reconciliation.
 */
'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { createFlowError } from '@flow/db';
import { getPaymentProvider } from '@flow/agents/providers';
import type { Subscription } from '@flow/agents/providers';
import { getTierConfig } from '@/lib/config/tier-config';
import type { TierConfig } from '@/lib/config/tier-config';
import { z } from 'zod';
import type { ActionResult } from '@flow/types';
import {
  fetchWorkspaceForBilling,
  requireOwner,
  toFailure,
  withTenantContext,
} from './_helpers';

const syncInputSchema = z.object({
  sessionId: z.string().optional(),
});

interface SyncSuccess {
  synced: true;
}

export async function syncStripeDataAction(input: {
  sessionId?: string;
}): Promise<ActionResult<SyncSuccess>> {
  const parsed = syncInputSchema.safeParse(input);
  if (!parsed.success) {
    return toFailure(
      createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.message,
        'validation',
      ),
    );
  }

  const supabase = await getServerSupabase();
  return withTenantContext<SyncSuccess>(supabase, async (ctx) => {
    const forbidden = requireOwner(ctx);
    if (forbidden) return toFailure(forbidden);

    const workspace = await fetchWorkspaceForBilling(supabase, ctx.workspaceId);
    if (!workspace) {
      // Best-effort: still return success so the page renders.
      return { success: true, data: { synced: true } };
    }

    // Path A: we already have a stripe_subscription_id — fetch + verify +
    // upsert via the user-scoped client. The RPC is SECURITY DEFINER and
    // granted to `authenticated`; no service_role required.
    if (workspace.stripe_subscription_id) {
      await syncFromSubscription(supabase, ctx.workspaceId, workspace);
      return { success: true, data: { synced: true } };
    }

    // Path B: no local subscription id yet, but the success redirect gave us
    // a checkout session id — expand it to find the new subscription.
    if (parsed.data.sessionId) {
      await syncFromCheckoutSession(
        supabase,
        ctx.workspaceId,
        workspace,
        parsed.data.sessionId,
      );
    }

    return { success: true, data: { synced: true } };
  });
}

async function syncFromSubscription(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  workspaceId: string,
  workspace: {
    stripe_subscription_id: string | null;
    stripe_customer_id: string | null;
  },
): Promise<void> {
  if (!workspace.stripe_subscription_id) return;
  const provider = getPaymentProvider('stripe');
  let subscription: Subscription;
  try {
    subscription = await provider.getSubscription(
      workspace.stripe_subscription_id,
    );
  } catch (err) {
    logSyncError(workspaceId, err);
    return;
  }
  if (
    workspace.stripe_customer_id &&
    subscription.customerId &&
    subscription.customerId !== workspace.stripe_customer_id
  ) {
    // Customer mismatch — refuse to write; flag for reconciliation (9-7).
    logSyncError(workspaceId, new Error('subscription customer id mismatch'));
    return;
  }

  await upsertLocalSubscription(supabase, workspaceId, subscription);
}

async function syncFromCheckoutSession(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  workspaceId: string,
  workspace: { stripe_customer_id: string | null },
  sessionId: string,
): Promise<void> {
  const provider = getPaymentProvider('stripe');
  let result: { subscriptionId: string | null; customerId: string | null };
  try {
    result = await provider.getCheckoutSession(sessionId);
  } catch (err) {
    logSyncError(workspaceId, err);
    return;
  }

  const subscriptionId = result.subscriptionId;
  const customerId = result.customerId;
  if (!subscriptionId || !customerId) return;
  if (
    workspace.stripe_customer_id &&
    customerId !== workspace.stripe_customer_id
  ) {
    logSyncError(
      workspaceId,
      new Error('checkout session customer id mismatch'),
    );
    return;
  }

  let subscription: Subscription;
  try {
    subscription = await provider.getSubscription(subscriptionId);
  } catch (err) {
    logSyncError(workspaceId, err);
    return;
  }

  await upsertLocalSubscription(supabase, workspaceId, subscription);
}

async function upsertLocalSubscription(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  workspaceId: string,
  subscription: Subscription,
): Promise<void> {
  // AC4: user-scoped client after the owner check. The RPC is SECURITY DEFINER
  // and granted to `authenticated`; service_role is unnecessary here.
  const periodStart = subscription.currentPeriodStart;
  const periodEnd = subscription.currentPeriodEnd;
  const tier = await mapPriceIdToTier(subscription.priceId);
  const status = mapStatusForRpc(subscription.status);
  if (!tier || !status) {
    logSyncError(
      workspaceId,
      new Error(
        `unmapped subscription: tier=${tier ?? 'null'}, status=${status ?? 'null'}`,
      ),
    );
    return;
  }
  try {
    const { data, error: rpcError } = await supabase.rpc(
      'upsert_workspace_subscription',
      {
        p_workspace_id: workspaceId,
        p_stripe_customer_id: subscription.customerId,
        p_stripe_subscription_id: subscription.providerSubscriptionId,
        p_tier: tier,
        p_status: status,
        p_current_period_start: periodStart,
        p_current_period_end: periodEnd,
        p_cancel_at_period_end: subscription.cancelAtPeriodEnd,
      },
    );
    if (rpcError) {
      logSyncError(
        workspaceId,
        new Error(
          `upsert_workspace_subscription rpc error: ${rpcError.message}`,
        ),
      );
      return;
    }
    if (data && typeof data === 'object' && 'error' in data) {
      logSyncError(
        workspaceId,
        new Error(
          `upsert_workspace_subscription logical error: ${String(data.error)}`,
        ),
      );
    }
  } catch (err) {
    logSyncError(workspaceId, err);
  }
}

/**
 * Map a Stripe price ID to the Flow OS tier using the canonical cached config.
 * Returns null when the price is not a known plan price.
 */
async function mapPriceIdToTier(
  priceId: string,
): Promise<'free' | 'pro' | 'agency' | null> {
  let config: TierConfig;
  try {
    config = await getTierConfig();
  } catch {
    return null;
  }
  if (config.stripePrices.pro_monthly === priceId) return 'pro';
  if (config.stripePrices.agency_monthly === priceId) return 'agency';
  return null;
}

/**
 * Map the provider's subscription status into the DB CHECK-constrained set
 * (`free|active|past_due|cancelled`).
 *
 * Mirrors the 9-3a webhook source-of-truth mapping in
 * `apps/web/lib/stripe/handlers/subscription-updated.ts`. Unknown statuses
 * are rejected (return null) so a transient unmapped status never upgrades
 * or downgrades the user incorrectly.
 */
function mapStatusForRpc(
  status: Subscription['status'],
): 'free' | 'active' | 'past_due' | 'cancelled' | null {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due') return 'past_due';
  if (
    status === 'cancelled' ||
    (status as string) === 'canceled' ||
    (status as string) === 'unpaid' ||
    (status as string) === 'incomplete' ||
    (status as string) === 'incomplete_expired'
  ) {
    return 'cancelled';
  }
  return null;
}

function logSyncError(workspaceId: string, err: unknown): void {
  console.error('syncStripeDataAction failed', {
    workspaceId,
    error: err instanceof Error ? err.message : String(err),
  });
}
