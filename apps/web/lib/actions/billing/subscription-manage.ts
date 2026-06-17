/**
 * cancelSubscriptionAction + reactivateSubscriptionAction (Story 9.3b, AC3 — FR58).
 *
 * Both actions call Stripe directly and DO NOT write local DB state — the
 * `customer.subscription.updated` webhook (9-3a) is the source of truth for
 * the workspace row. We invalidate the workspace cache tag after a successful
 * Stripe call so the UI refreshes promptly once the webhook reconciles.
 *
 * Cancel schedules cancellation at period end (user keeps access through the
 * current period). Reactivate clears the scheduled cancellation.
 */
'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { createFlowError, cacheTag } from '@flow/db';
import { getPaymentProvider } from '@flow/agents/providers';
import { manageSubscriptionSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import {
  fetchWorkspaceForBilling,
  requireOwner,
  toFailure,
  withTenantContext,
} from './_helpers';

/**
 * Reject Free tier / missing subscription. EC11: data drift where status is
 * `active` but `stripe_subscription_id` is null is also rejected — flag drift,
 * reconciliation job (9-7) reconciles.
 */
function rejectNoSubscription(
  workspace: { subscription_status: string; stripe_subscription_id: string | null },
): ActionResult<{ cancelAtPeriodEnd: true }> | null {
  if (workspace.subscription_status === 'free' || !workspace.stripe_subscription_id) {
    return toFailure(
      createFlowError(
        409,
        'NO_ACTIVE_SUBSCRIPTION',
        'No active subscription to cancel.',
        'financial',
      ),
    );
  }
  return null;
}

export async function cancelSubscriptionAction(
  input?: unknown,
): Promise<ActionResult<{ cancelAtPeriodEnd: true }>> {
  const parsed = manageSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return toFailure(
      createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
    );
  }

  const supabase = await getServerSupabase();
  return withTenantContext<{ cancelAtPeriodEnd: true }>(supabase, async (ctx) => {
    const forbidden = requireOwner(ctx);
    if (forbidden) return toFailure(forbidden);

    const workspace = await fetchWorkspaceForBilling(supabase, ctx.workspaceId);
    if (!workspace) {
      return toFailure(
        createFlowError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 'validation'),
      );
    }

    const rejected = rejectNoSubscription(workspace);
    if (rejected) return rejected;

    const provider = getPaymentProvider('stripe');
    try {
      // false = cancel at period end (EC6: idempotent — Stripe no-ops if already
      // scheduled). The webhook sets `subscription_cancel_at_period_end=true`.
      await provider.cancelSubscription(workspace.stripe_subscription_id!, false);
    } catch {
      return toFailure(
        createFlowError(502, 'STRIPE_ERROR', 'Failed to schedule cancellation.', 'financial'),
      );
    }

    revalidateTag(cacheTag('workspace', ctx.workspaceId));
    return { success: true, data: { cancelAtPeriodEnd: true } };
  });
}

export async function reactivateSubscriptionAction(
  input?: unknown,
): Promise<ActionResult<{ reactivated: true }>> {
  const parsed = manageSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return toFailure(
      createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
    );
  }

  const supabase = await getServerSupabase();
  return withTenantContext<{ reactivated: true }>(supabase, async (ctx) => {
    const forbidden = requireOwner(ctx);
    if (forbidden) return toFailure(forbidden);

    const workspace = await fetchWorkspaceForBilling(supabase, ctx.workspaceId);
    if (!workspace) {
      return toFailure(
        createFlowError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 'validation'),
      );
    }

    const rejected = rejectNoSubscription(workspace);
    if (rejected) {
      // Re-cast the strongly-typed rejection to the reactivate result shape.
      return rejected as unknown as ActionResult<{ reactivated: true }>;
    }

    const provider = getPaymentProvider('stripe');
    try {
      // EC7: if the subscription has already expired (period end passed),
      // `resumeSubscription` fails with a Stripe error → STRIPE_ERROR 502.
      await provider.resumeSubscription(workspace.stripe_subscription_id!);
    } catch {
      return toFailure(
        createFlowError(502, 'STRIPE_ERROR', 'Failed to reactivate subscription.', 'financial'),
      );
    }

    revalidateTag(cacheTag('workspace', ctx.workspaceId));
    return { success: true, data: { reactivated: true } };
  });
}
