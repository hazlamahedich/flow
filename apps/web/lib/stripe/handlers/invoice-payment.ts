import type { SupabaseClient } from '@supabase/supabase-js';
import type { WebhookEvent, WebhookProcessingResult } from '../webhook-types';

function getMetadata(object: Record<string, unknown>): Record<string, string> {
  const metadata = object.metadata ?? {};
  return typeof metadata === 'object' &&
    metadata !== null &&
    !Array.isArray(metadata)
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

async function handleSubscriptionInvoiceEvent(
  supabase: SupabaseClient,
  event: WebhookEvent,
  status: 'active' | 'past_due',
): Promise<WebhookProcessingResult> {
  const object = event.data.object;
  const subscription = object.subscription;
  const customerId = object.customer as string | undefined;
  const metadata = getMetadata(object);

  // EC8: one-time invoice events have no `subscription` field. Return processed:true
  // so the route does NOT mark the event failed — the 7-5 branch in route.ts owns
  // `invoice.payment_failed` for one-time invoices (via `invoice_payment_attempts`).
  // Note: the route currently routes ALL `invoice.payment_failed` events to this
  // handler; if 7-5's branch must also handle one-time invoice events, the route
  // dispatch needs to be updated separately.
  if (!subscription) {
    return {
      processed: true,
      reason: 'not a subscription invoice; deferred to 7-5 branch',
    };
  }

  if (!customerId) {
    return { processed: false, reason: 'invoice event missing customer id' };
  }

  const workspaceId =
    metadata.workspace_id ??
    (await findWorkspaceIdByCustomer(supabase, customerId));
  if (!workspaceId) {
    return {
      processed: false,
      reason: 'workspace not found for subscription invoice',
    };
  }

  const periodEnd = object.period_end as number | undefined;
  const { error } = await supabase.rpc('set_workspace_subscription_status', {
    p_workspace_id: workspaceId,
    p_status: status,
    p_current_period_end: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
    p_clear_period_end: false,
  });

  if (error) {
    return { processed: false, reason: error.message };
  }

  return { processed: true };
}

export async function handleInvoicePaid(
  supabase: SupabaseClient,
  event: WebhookEvent,
): Promise<WebhookProcessingResult> {
  return handleSubscriptionInvoiceEvent(supabase, event, 'active');
}

export async function handleInvoicePaymentFailed(
  supabase: SupabaseClient,
  event: WebhookEvent,
): Promise<WebhookProcessingResult> {
  return handleSubscriptionInvoiceEvent(supabase, event, 'past_due');
}
