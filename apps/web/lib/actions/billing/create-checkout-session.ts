/**
 * createCheckoutSessionAction — subscription checkout (Story 9.3b, AC1 — FR55).
 *
 * Mints a Stripe Checkout URL for upgrading the workspace to a recurring
 * subscription tier (Pro / Agency). Lazy-creates a Stripe Customer on first
 * upgrade (EC1) and persists `stripe_customer_id` before creating the session
 * so the 9-3a webhook's customer-lookup fallback always works.
 *
 * Constraints (project-context.md):
 *  - User-facing action → `getServerSupabase()` + `requireTenantContext` only.
 *    `service_role` is forbidden here (project-context.md:150).
 *  - Never trusts client `workspaceId` — uses `ctx.workspaceId` (project-context.md:136).
 *  - Provider abstraction: goes through `getPaymentProvider('stripe')`, never
 *    `fetch('https://api.stripe.com/...')` directly (project-context.md:174-177).
 *  - Metadata uses snake_case `workspace_id` to match the 9-3a webhook handlers.
 */
'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { createFlowError } from '@flow/db';
import { getPaymentProvider } from '@flow/agents/providers';
import { createCheckoutSessionSchema } from '@flow/types';
import type { ActionResult, FlowErrorBase } from '@flow/types';
import { getAppUrl } from '@/lib/actions/portal/helpers';
import {
  checkBillingRateLimit,
  fetchWorkspaceForBilling,
  requireOwner,
  resolvePriceId,
  toFailure,
  withTenantContext,
} from './_helpers';

export async function createCheckoutSessionAction(
  input: unknown,
): Promise<ActionResult<{ url: string }>> {
  const parsed = createCheckoutSessionSchema.safeParse(input);
  if (!parsed.success) {
    return toFailure(
      createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
    );
  }
  const { tier, interval } = parsed.data;

  const supabase = await getServerSupabase();
  return withTenantContext<{ url: string }>(supabase, async (ctx) => {
    const forbidden = requireOwner(ctx);
    if (forbidden) return toFailure(forbidden);

    const limited = await checkBillingRateLimit(supabase, ctx.workspaceId, 'checkout');
    if (limited) return toFailure(limited);

    const workspace = await fetchWorkspaceForBilling(supabase, ctx.workspaceId);
    if (!workspace) {
      return toFailure(
        createFlowError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 'validation'),
      );
    }

    // Resolve priceId first — fail fast on misconfigured prices (EC3).
    let priceId: string;
    try {
      priceId = await resolvePriceId(tier, interval);
    } catch (err) {
      return toFailure(err as FlowErrorBase);
    }

    // Lazy-create Customer (EC1). Idempotency key `customer:${workspaceId}`
    // prevents duplicate customers on retry (EC2). Persist BEFORE creating
    // the checkout session so the webhook's customer-lookup fallback works.
    const customerId = await ensureCustomerId(supabase, ctx, workspace);
    if (!('ok' in customerId)) return customerId;

    const provider = getPaymentProvider('stripe');
    const appUrl = getAppUrl();
    const metadata = { workspace_id: ctx.workspaceId };

    try {
      const session = await provider.createSubscriptionCheckoutSession({
        customerId: customerId.ok,
        priceId,
        successUrl: `${appUrl}/settings/billing?sync=1&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appUrl}/settings/billing?status=cancel`,
        metadata,
        idempotencyKey: `checkout:${ctx.workspaceId}:${tier}:${interval}`,
      });
      return { success: true, data: { url: session.url } };
    } catch {
      return toFailure(
        createFlowError(502, 'STRIPE_ERROR', 'Failed to create checkout session.', 'financial'),
      );
    }
  });
}

/**
 * Lazy-create + persist the Stripe Customer ID for the workspace.
 *
 * Returns `{ ok: customerId }` on success or an ActionResult failure shape
 * on error. Callers check `if (!('ok' in result)) return result;` to bail
 * out early.
 */
async function ensureCustomerId(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  ctx: { workspaceId: string; userId: string },
  workspace: { stripe_customer_id: string | null; name: string },
): Promise<{ ok: string } | ActionResult<{ url: string }>> {
  if (workspace.stripe_customer_id) {
    return { ok: workspace.stripe_customer_id };
  }

  // Read the owner's email for the Stripe Customer record. `requireTenantContext`
  // already proved the user exists, so this is a cheap re-read.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? '';

  const provider = getPaymentProvider('stripe');
  let providerCustomerId: string;
  try {
    const customer = await provider.createCustomer({
      email,
      name: workspace.name,
      workspaceId: ctx.workspaceId,
      metadata: { workspace_id: ctx.workspaceId },
      idempotencyKey: `customer:${ctx.workspaceId}`,
    });
    providerCustomerId = customer.providerCustomerId;
  } catch {
    return toFailure(
      createFlowError(502, 'STRIPE_ERROR', 'Failed to create billing customer.', 'financial'),
    );
  }

  const { error: updateError } = await supabase
    .from('workspaces')
    .update({ stripe_customer_id: providerCustomerId })
    .eq('id', ctx.workspaceId);
  if (updateError) {
    return toFailure(
      createFlowError(500, 'INTERNAL_ERROR', 'Failed to link customer to workspace.', 'system'),
    );
  }

  return { ok: providerCustomerId };
}
