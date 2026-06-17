import type { SupabaseClient } from '@supabase/supabase-js';
import { getTierConfig } from '@/lib/config/tier-config';
import { StripePaymentProvider } from '@flow/agents/providers';
import type { WebhookEvent, WebhookProcessingResult } from '../webhook-types';

function getMetadata(event: WebhookEvent): Record<string, string> {
  const object = event.data.object;
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

async function activateSubscription(
  supabase: SupabaseClient,
  event: WebhookEvent,
): Promise<WebhookProcessingResult> {
  const metadata = getMetadata(event);
  const object = event.data.object;
  const customerId = object.customer as string | undefined;
  const subscriptionIdRaw = object.subscription;

  if (!customerId || typeof subscriptionIdRaw !== 'string') {
    return {
      processed: false,
      reason: 'missing customer or subscription id in checkout.session.completed',
    };
  }
  const subscriptionId = subscriptionIdRaw;

  let workspaceId = metadata.workspace_id;
  if (!workspaceId) {
    workspaceId = await findWorkspaceIdByCustomer(supabase, customerId);
  }
  if (!workspaceId) {
    return { processed: false, reason: 'missing workspace_id (metadata + customer lookup failed)' };
  }

  // Stripe sends `subscription` as a string ID on checkout.session.completed.
  // Expand via the provider abstraction (spec dev notes line 155).
  const provider = new StripePaymentProvider({
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  });
  const subscription = await provider.getSubscription(subscriptionId);

  const periodStartMs = Date.parse(subscription.currentPeriodStart);
  const periodEndMs = Date.parse(subscription.currentPeriodEnd);
  const currentPeriodStart = Number.isNaN(periodStartMs) ? undefined : periodStartMs / 1000;
  const currentPeriodEnd = Number.isNaN(periodEndMs) ? undefined : periodEndMs / 1000;
  const cancelAtPeriodEnd = subscription.cancelAtPeriodEnd;

  const priceIdValue = subscription.priceId;
  if (!priceIdValue) {
    return { processed: false, reason: 'subscription checkout completed without a price id' };
  }

  const config = await getTierConfig();
  const tier = mapPriceIdToTier(priceIdValue, config);
  if (!tier) {
    return { processed: false, reason: `price ${priceIdValue} does not map to a known tier` };
  }

  const { error } = await supabase.rpc('upsert_workspace_subscription', {
    p_workspace_id: workspaceId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscriptionId,
    p_tier: tier,
    p_status: 'active',
    p_current_period_start: currentPeriodStart
      ? new Date(currentPeriodStart * 1000).toISOString()
      : null,
    p_current_period_end: currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : null,
    p_cancel_at_period_end: cancelAtPeriodEnd,
  });

  if (error) {
    return { processed: false, reason: error.message };
  }

  return { processed: true };
}

async function recordOneTimePayment(
  supabase: SupabaseClient,
  event: WebhookEvent,
): Promise<WebhookProcessingResult> {
  const metadata = getMetadata(event);
  const object = event.data.object;
  const invoiceId = metadata.invoice_id;
  const workspaceId = metadata.workspace_id;
  const amountTotal = object.amount_total as number | undefined;
  const paymentIntent = object.payment_intent as string | undefined;
  const created = object.created as number | undefined;

  if (!invoiceId || !workspaceId || amountTotal === undefined || !paymentIntent || !created) {
    return { processed: false, reason: 'missing invoice_id, workspace_id, amount_total, payment_intent, or created' };
  }

  const { data: existing } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('id', invoiceId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!existing) {
    return { processed: false, reason: 'invoice not found' };
  }

  if (['paid', 'voided'].includes(existing.status as string)) {
    return { processed: true, reason: `invoice already ${existing.status as string}` };
  }

  const { data: result, error } = await supabase.rpc('record_payment_with_concurrency', {
    p_invoice_id: invoiceId,
    p_workspace_id: workspaceId,
    p_amount_cents: amountTotal,
    p_payment_method: 'stripe',
    p_payment_date: new Date(created * 1000).toISOString().split('T')[0],
    p_stripe_payment_intent_id: paymentIntent,
  });

  if (error) {
    return { processed: false, reason: error.message };
  }

  const resultObj = result as Record<string, unknown> | null;
  const errorCode = resultObj?.error as string | undefined;
  if (errorCode) {
    if (errorCode === 'INVOICE_ALREADY_PAID' || errorCode === 'INVOICE_VOIDED') {
      return { processed: true, reason: `record_payment skipped: ${errorCode}` };
    }
    return { processed: false, reason: `record_payment failed: ${errorCode}` };
  }

  await insertPaymentConfirmedNotification(supabase, invoiceId, workspaceId, amountTotal);

  return { processed: true };
}

async function insertPaymentConfirmedNotification(
  supabase: SupabaseClient,
  invoiceId: string,
  workspaceId: string,
  amountCents: number,
): Promise<void> {
  try {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('client_id')
      .eq('id', invoiceId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    const clientId = (invoice as Record<string, unknown> | null)?.client_id as string | undefined;
    if (!clientId) return;

    await supabase.rpc('log_client_notification', {
      p_type: 'payment_confirmed',
      p_client_id: clientId,
      p_workspace_id: workspaceId,
      p_payload: { invoice_id: invoiceId, amount_cents: amountCents } as Record<string, unknown>,
      p_provider_message_id: null,
      p_status: 'pending',
      p_error: null,
    });
  } catch (err) {
    console.error('Failed to insert payment_confirmed notification', {
      stripe_event_id: invoiceId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function handleCheckoutSessionCompleted(
  supabase: SupabaseClient,
  event: WebhookEvent,
): Promise<WebhookProcessingResult> {
  const metadata = getMetadata(event);
  const object = event.data.object;

  if (metadata.invoice_id) {
    return recordOneTimePayment(supabase, event);
  }

  if (object.mode === 'subscription') {
    return activateSubscription(supabase, event);
  }

  return { processed: false, reason: 'unrecognized checkout context' };
}
