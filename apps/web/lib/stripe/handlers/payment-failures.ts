import type { SupabaseClient } from '@supabase/supabase-js';
import { mapStripeDeclineCode } from '@flow/shared';
import type { WebhookEvent, WebhookProcessingResult } from '../webhook-types';

/**
 * 7-5 failure-event branch — handles `payment_intent.payment_failed` and
 * `checkout.session.expired`. Extracted from `route.ts` in 9-3a to keep the
 * HTTP wrapper under the 250-line hard limit.
 *
 * Records a failed `invoice_payment_attempts` row keyed by Stripe event ID.
 * Returns `{ processed: false, reason }` if required metadata is missing so
 * the dispatcher marks the event as failed (mirrors 7-5 semantics).
 */
export async function handlePaymentFailure(
  supabase: SupabaseClient,
  event: WebhookEvent,
): Promise<WebhookProcessingResult> {
  const object = event.data.object;
  const metadata = (object.metadata ?? {}) as Record<string, string>;
  const invoiceId = metadata.invoice_id;
  const workspaceId = metadata.workspace_id;

  if (!invoiceId || !workspaceId) {
    return {
      processed: false,
      reason: 'Missing invoice_id or workspace_id in event metadata',
    };
  }

  const amountCents =
    event.type === 'checkout.session.expired'
      ? Number(object.amount_total ?? 0)
      : Number(object.amount ?? 0);

  const declineCode = (
    object.last_payment_error as Record<string, unknown> | undefined
  )?.decline_code as string | undefined;

  const mapped = mapStripeDeclineCode(declineCode);

  const { error: insertErr } = await supabase.from('invoice_payment_attempts').insert({
    invoice_id: invoiceId,
    workspace_id: workspaceId,
    stripe_event_id: event.id,
    attempt_type: 'stripe_checkout',
    status: 'failed',
    error_code: declineCode ?? null,
    error_message: mapped?.message ?? 'Unknown decline',
    amount_cents: amountCents,
  });

  if (insertErr) {
    return { processed: false, reason: insertErr.message };
  }

  return { processed: true };
}
