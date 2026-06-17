import { StripePaymentProvider } from '@flow/agents/providers';
import type { WebhookEvent as ProviderWebhookEvent } from '@flow/agents/providers';
import type { WebhookEvent } from './webhook-types';

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): WebhookEvent {
  // One provider per request — consistent with the rest of the codebase and
  // the project-context "one per request on server" guidance.
  const provider = new StripePaymentProvider({
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: secret,
  });

  const verified = provider.constructWebhookEvent(payload, signature, secret);

  const payloadData = verified.payload as Record<string, unknown>;
  const data = payloadData.data as { object: Record<string, unknown> } | undefined;

  if (!data) {
    throw new Error('Stripe event missing data.object');
  }

  return {
    id: verified.id,
    type: verified.type,
    created: Date.parse(verified.createdAt) / 1000,
    data,
  };
}

export function toProviderWebhookEvent(event: WebhookEvent): ProviderWebhookEvent {
  return {
    id: event.id,
    type: event.type,
    createdAt: new Date(event.created * 1000).toISOString(),
    payload: {
      id: event.id,
      type: event.type,
      created: event.created,
      data: event.data,
    },
  };
}
