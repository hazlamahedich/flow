import { NextResponse } from 'next/server';
import { createServiceClient } from '@flow/db';
import { processStripeEvent } from '@/lib/stripe/handlers';
import { verifyWebhookSignature } from '@/lib/stripe/verify-webhook-signature';
import type { WebhookEvent } from '@/lib/stripe/webhook-types';

const ALLOWED_STRIPE_KEYS = new Set([
  'id',
  'type',
  'data',
  'object',
  'metadata',
  'amount',
  'amount_total',
  'currency',
  'status',
  'created',
  'livemode',
  'invoice_id',
  'workspace_id',
  'payment_intent',
  'customer',
  'stripe_event_id',
  'last_payment_error',
  'decline_code',
  'subscription',
  'items',
  'current_period_start',
  'current_period_end',
  'cancel_at_period_end',
  'mode',
]);

const SENSITIVE_KEY_PATTERNS = [
  /^customer_details$/,
  /^payment_method_details$/,
  /^shipping$/,
  /^billing_details$/,
  /^last4$/,
  /^exp_month$/,
  /^exp_year$/,
  /^cvc_check$/,
  /^number$/,
  /^card$/,
  /^(\d{13,19})$/, // raw card number strings
];

function scrubPayload(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(scrubPayload);
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const isAllowed = ALLOWED_STRIPE_KEYS.has(key);
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
    if (!isAllowed || isSensitive) continue;
    result[key] = scrubPayload(value);
  }
  return result;
}

function toWebhookEvent(stripeEvent: {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}): WebhookEvent {
  const payload = stripeEvent.payload;
  return {
    id: stripeEvent.id,
    type: stripeEvent.type,
    created: Date.parse(stripeEvent.createdAt) / 1000,
    data: payload.data as { object: Record<string, unknown> },
  };
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return new Response('Service misconfigured', { status: 500 });
  }

  let verifiedEvent: WebhookEvent;
  try {
    verifiedEvent = verifyWebhookSignature(rawBody, signature, secret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createServiceClient();

  const metadata = (verifiedEvent.data.object.metadata ?? {}) as Record<string, string>;
  const invoiceId = metadata.invoice_id;
  const workspaceId = metadata.workspace_id;

  // Atomic dedup insert
  const { error: dedupError } = await supabase.from('stripe_webhook_events').insert({
    stripe_event_id: verifiedEvent.id,
    event_type: verifiedEvent.type,
    status: 'pending',
    workspace_id: workspaceId ?? null,
    invoice_id: invoiceId ?? null,
    payload_json: scrubPayload(verifiedEvent) as Record<string, unknown>,
    expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  });

  if (dedupError) {
    if (dedupError.code === '23505') {
      return NextResponse.json({ received: true }, { status: 200 });
    }
    console.error('stripe_webhook_events insert failed', {
      stripe_event_id: verifiedEvent.id,
      error: dedupError.message,
    });
    return new Response('Internal Server Error', { status: 500 });
  }

  try {
    const result = await processStripeEvent(supabase, verifiedEvent);
    if (!result.processed) {
      await supabase
        .from('stripe_webhook_events')
        .update({ status: 'failed', error_message: result.reason ?? null })
        .eq('stripe_event_id', verifiedEvent.id);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    await supabase
      .from('stripe_webhook_events')
      .update({ status: 'processed' })
      .eq('stripe_event_id', verifiedEvent.id);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Webhook processing error caught', {
      stripe_event_id: verifiedEvent.id,
      error: errMsg,
    });
    await supabase
      .from('stripe_webhook_events')
      .update({ status: 'failed', error_message: errMsg })
      .eq('stripe_event_id', verifiedEvent.id);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

export { toWebhookEvent };
