import { NextResponse } from 'next/server';
import { createServiceClient } from '@flow/db';
import { StripePaymentProvider } from '@flow/agents/providers';
import { mapStripeDeclineCode } from '@flow/shared';
import type { WebhookEvent } from '@flow/agents/providers';

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

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';

  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return new Response('Service misconfigured', { status: 500 });
  }

  let event: WebhookEvent;
  try {
    const provider = new StripePaymentProvider({
      secretKey: process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: secret,
    });
    event = provider.constructWebhookEvent(rawBody, signature, secret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createServiceClient();

  const payloadObj = event.payload as Record<string, unknown>;
  const dataObj = (payloadObj.data as Record<string, unknown> | undefined)?.object as
    | Record<string, unknown>
    | undefined;

  const metadata = (dataObj?.metadata ?? payloadObj.metadata ?? {}) as Record<string, string>;
  const invoiceId = metadata.invoice_id;
  const workspaceId = metadata.workspace_id;

  // Atomic dedup insert
  const { error: dedupError } = await supabase
    .from('stripe_webhook_events')
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      status: 'pending',
      workspace_id: workspaceId ?? null,
      invoice_id: invoiceId ?? null,
      payload_json: scrubPayload(event.payload) as Record<string, unknown>,
      expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    });

  if (dedupError) {
    if (dedupError.code === '23505') {
      // Duplicate — ACK immediately
      return NextResponse.json({ received: true }, { status: 200 });
    }
    console.error('stripe_webhook_events insert failed', { stripe_event_id: event.id, error: dedupError.message });
    return new Response('Internal Server Error', { status: 500 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      // Story 9-3 owns success-path side effects. We ACK and log.
      if (invoiceId && workspaceId) {
        const { data: inv } = await supabase
          .from('invoices')
          .select('id, status')
          .eq('id', invoiceId)
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        if (inv && !['sent', 'viewed'].includes(inv.status as string)) {
          console.warn('checkout.session.completed for non-actionable invoice', {
            stripe_event_id: event.id,
            invoice_id: invoiceId,
            invoice_status: inv.status,
          });
        }
      }
    } else if (
      event.type === 'payment_intent.payment_failed' ||
      event.type === 'checkout.session.expired'
    ) {
      if (!invoiceId || !workspaceId) {
        console.warn('Missing metadata in failure event', {
          stripe_event_id: event.id,
          event_type: event.type,
        });
        await supabase
          .from('stripe_webhook_events')
          .update({ status: 'failed', error_message: 'Missing invoice_id or workspace_id in event metadata' })
          .eq('stripe_event_id', event.id);
        return NextResponse.json({ received: true }, { status: 200 });
      } else {
        const amountCents =
          event.type === 'checkout.session.expired'
            ? Number((dataObj?.amount_total as number) ?? 0)
            : Number((dataObj?.amount as number) ?? 0);

        const declineCode =
          (dataObj?.last_payment_error as Record<string, unknown> | undefined)
            ?.decline_code as string | undefined;

        const mapped = mapStripeDeclineCode(declineCode as string | undefined);

        const { error: insertErr } = await supabase.from('invoice_payment_attempts').insert({
          invoice_id: invoiceId,
          workspace_id: workspaceId,
          stripe_event_id: event.id,
          attempt_type: 'stripe_checkout',
          status: 'failed',
          error_code: declineCode ?? null,
          error_message: mapped.message,
          amount_cents: amountCents,
        });

        if (insertErr) {
          console.error('invoice_payment_attempts insert failed', {
            stripe_event_id: event.id,
            error: insertErr.message,
          });
          await supabase
            .from('stripe_webhook_events')
            .update({ status: 'failed', error_message: insertErr.message })
            .eq('stripe_event_id', event.id);
          return NextResponse.json({ received: true }, { status: 200 });
        }
      }
    }

    // Mark processed
    await supabase
      .from('stripe_webhook_events')
      .update({ status: 'processed' })
      .eq('stripe_event_id', event.id);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Webhook processing error caught', {
      stripe_event_id: event.id,
      error: errMsg,
    });
    await supabase
      .from('stripe_webhook_events')
      .update({ status: 'failed', error_message: errMsg })
      .eq('stripe_event_id', event.id);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
