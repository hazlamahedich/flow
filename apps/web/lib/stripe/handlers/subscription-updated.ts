import type { SupabaseClient } from '@supabase/supabase-js';
import { getTierConfig } from '@/lib/config/tier-config';
import { StripePaymentProvider } from '@flow/agents/providers';
import type { WebhookEvent, WebhookProcessingResult } from '../webhook-types';

function getMetadata(object: Record<string, unknown>): Record<string, string> {
  const metadata = object.metadata ?? {};
  return typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata)
    ? (metadata as Record<string, string>)
    : {};
}

async function findWorkspaceIdByCustomer(
  supabase: SupabaseClient,
  customerId: string,
): Promise<string | undefined> {
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return (data as Record<string, unknown> | null)?.id as string | undefined;
}

function mapPriceIdToTier(
  priceId: string,
  config: { stripePrices: { pro_monthly: string; agency_monthly: string } },
): 'pro' | 'agency' | undefined {
  if (config.stripePrices.pro_monthly === priceId) return 'pro';
  if (config.stripePrices.agency_monthly === priceId) return 'agency';
  return undefined;
}

function mapSubscriptionStatus(
  stripeStatus: string,
): 'active' | 'past_due' | 'cancelled' | undefined {
  // AC1 CHECK only allows ('free', 'active', 'past_due', 'cancelled').
  // 'trialing' is intentionally mapped to 'active' (trial users can use the product).
  // 'canceled'/'unpaid'/'incomplete'/'incomplete_expired' map to 'cancelled'
  // because Stripe has stopped serving the subscription.
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active';
  if (stripeStatus === 'past_due') return 'past_due';
  if (
    stripeStatus === 'canceled' ||
    stripeStatus === 'unpaid' ||
    stripeStatus === 'incomplete' ||
    stripeStatus === 'incomplete_expired'
  ) {
    return 'cancelled';
  }
  return undefined;
}

async function syncSubscriptionFromEvent(
  supabase: SupabaseClient,
  event: WebhookEvent,
): Promise<WebhookProcessingResult> {
  const object = event.data.object;
  const subscriptionId = object.id as string | undefined;
  const customerId = object.customer as string | undefined;
  const metadata = getMetadata(object);

  if (!subscriptionId || !customerId) {
    return { processed: false, reason: 'missing subscription id or customer' };
  }

  let workspaceId = metadata.workspace_id;
  if (!workspaceId) {
    workspaceId = await findWorkspaceIdByCustomer(supabase, customerId);
  }
  if (!workspaceId) {
    return { processed: false, reason: 'workspace not found for subscription event' };
  }

  // `customer.subscription.updated` may carry a partial object (per spec dev
  // notes line 155). Expand via the provider to read full state.
  const provider = new StripePaymentProvider({
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  });
  const subscription = await provider.getSubscription(subscriptionId);

  const mappedStatus = mapSubscriptionStatus(subscription.status);
  if (!mappedStatus) {
    return { processed: false, reason: `unmapped subscription status: ${subscription.status}` };
  }

  const priceIdValue = subscription.priceId;
  if (!priceIdValue) {
    return { processed: false, reason: 'subscription event missing price id' };
  }

  const config = await getTierConfig();
  const tier = mapPriceIdToTier(priceIdValue, config);
  if (!tier) {
    return { processed: false, reason: `price ${priceIdValue} does not map to a known tier` };
  }

  const periodStartMs = Date.parse(subscription.currentPeriodStart);
  const periodEndMs = Date.parse(subscription.currentPeriodEnd);
  const currentPeriodStart = Number.isNaN(periodStartMs) ? null : new Date(periodStartMs).toISOString();
  const currentPeriodEnd = Number.isNaN(periodEndMs) ? null : new Date(periodEndMs).toISOString();

  const { error } = await supabase.rpc('upsert_workspace_subscription', {
    p_workspace_id: workspaceId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscriptionId,
    p_tier: tier,
    p_status: mappedStatus,
    p_current_period_start: currentPeriodStart,
    p_current_period_end: currentPeriodEnd,
    p_cancel_at_period_end: subscription.cancelAtPeriodEnd,
  });

  if (error) {
    return { processed: false, reason: error.message };
  }

  return { processed: true };
}

export async function handleSubscriptionUpdated(
  supabase: SupabaseClient,
  event: WebhookEvent,
): Promise<WebhookProcessingResult> {
  return syncSubscriptionFromEvent(supabase, event);
}

export async function handleSubscriptionDeleted(
  supabase: SupabaseClient,
  event: WebhookEvent,
): Promise<WebhookProcessingResult> {
  const object = event.data.object;
  const subscriptionId = object.id as string | undefined;
  const customerId = object.customer as string | undefined;
  const metadata = getMetadata(object);

  if (!subscriptionId) {
    return { processed: false, reason: 'missing subscription id' };
  }

  let workspaceId = metadata.workspace_id;
  if (!workspaceId && customerId) {
    workspaceId = await findWorkspaceIdByCustomer(supabase, customerId);
  }
  if (!workspaceId) {
    return { processed: false, reason: 'missing workspace_id or customer for lookup' };
  }

  const { error } = await supabase.rpc('set_workspace_subscription_status', {
    p_workspace_id: workspaceId,
    p_status: 'cancelled',
    p_clear_period_end: true,
  });

  if (error) {
    return { processed: false, reason: error.message };
  }

  return { processed: true };
}
