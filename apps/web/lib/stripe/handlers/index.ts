import type { SupabaseClient } from '@supabase/supabase-js';
import type { WebhookEvent, WebhookProcessingResult } from '../webhook-types';
import { handleCheckoutSessionCompleted } from './checkout-completed';
import {
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from './subscription-updated';
import {
  handleInvoicePaid,
  handleInvoicePaymentFailed,
} from './invoice-payment';
import { handlePaymentFailure } from './payment-failures';

export async function processStripeEvent(
  supabase: SupabaseClient,
  event: WebhookEvent,
): Promise<WebhookProcessingResult> {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(supabase, event);
    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(supabase, event);
    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(supabase, event);
    case 'invoice.paid':
      return handleInvoicePaid(supabase, event);
    case 'invoice.payment_failed':
      // EC8: subscription invoice failures route to AC5 status sync.
      // One-time invoice failures are returned as processed:true with a
      // "deferred to 7-5 branch" reason and fall through to `handlePaymentFailure`
      // below. We detect "subscription" presence inside `handleInvoicePaymentFailed`.
      return handleInvoicePaymentFailed(supabase, event);
    case 'payment_intent.payment_failed':
    case 'checkout.session.expired':
      return handlePaymentFailure(supabase, event);
    default:
      return {
        processed: false,
        reason: `unhandled event type: ${event.type}`,
      };
  }
}
