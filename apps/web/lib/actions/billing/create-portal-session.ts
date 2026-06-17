/**
 * createPortalSessionAction — Stripe Customer Portal (Story 9.3b, AC2 — FR58).
 *
 * Mints a short-lived Stripe Customer Portal URL for the workspace's owner to
 * self-manage payment methods, invoice history, and subscription cancellation
 * (per the portal configuration created once in the Stripe Dashboard).
 *
 * Returns NOT_CONFIGURED when no `stripe_customer_id` is linked yet (EC5: a
 * free-tier workspace with a customer ID is allowed through — the portal shows
 * payment methods; only null/empty is blocked).
 */
'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { createFlowError } from '@flow/db';
import { getPaymentProvider } from '@flow/agents/providers';
import { createPortalSessionSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import { getAppUrl } from '@/lib/actions/portal/helpers';
import {
  checkBillingRateLimit,
  fetchWorkspaceForBilling,
  requireOwner,
  toFailure,
  withTenantContext,
} from './_helpers';

export async function createPortalSessionAction(
  input?: unknown,
): Promise<ActionResult<{ url: string }>> {
  const parsed = createPortalSessionSchema.safeParse(input);
  if (!parsed.success) {
    return toFailure(
      createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
    );
  }

  const supabase = await getServerSupabase();
  return withTenantContext<{ url: string }>(supabase, async (ctx) => {
    const forbidden = requireOwner(ctx);
    if (forbidden) return toFailure(forbidden);

    const limited = await checkBillingRateLimit(supabase, ctx.workspaceId, 'portal');
    if (limited) return toFailure(limited);

    const workspace = await fetchWorkspaceForBilling(supabase, ctx.workspaceId);
    if (!workspace) {
      return toFailure(
        createFlowError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 'validation'),
      );
    }

    if (!workspace.stripe_customer_id) {
      return toFailure(
        createFlowError(
          409,
          'NOT_CONFIGURED',
          'No Stripe customer is linked to this workspace.',
          'financial',
        ),
      );
    }

    const provider = getPaymentProvider('stripe');
    try {
      const session = await provider.createPortalSession({
        customerId: workspace.stripe_customer_id,
        returnUrl: `${getAppUrl()}/settings/billing`,
      });
      return { success: true, data: { url: session.url } };
    } catch {
      return toFailure(
        createFlowError(502, 'STRIPE_ERROR', 'Unable to open billing portal.', 'financial'),
      );
    }
  });
}
