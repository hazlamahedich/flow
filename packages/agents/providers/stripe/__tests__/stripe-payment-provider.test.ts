// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  StripePaymentProvider,
  StripeApiError,
} from '../stripe-payment-provider';
import crypto from 'node:crypto';

describe('StripePaymentProvider.constructWebhookEvent', () => {
  const provider = new StripePaymentProvider({
    secretKey: 'sk_test_secret',
    webhookSecret: 'whsec_test_webhook_secret',
  });

  function buildSignature(
    secret: string,
    payload: string,
    timestamp: number,
  ): string {
    const signedPayload = `${timestamp}.${payload}`;
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    return `t=${timestamp},v1=${hmac}`;
  }

  it('accepts valid signature', () => {
    const secret = 'whsec_valid';
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      id: 'evt_123',
      type: 'payment_intent.payment_failed',
      created: timestamp,
    });
    const signature = buildSignature(secret, payload, timestamp);

    const event = provider.constructWebhookEvent(payload, signature, secret);
    expect(event.id).toBe('evt_123');
    expect(event.type).toBe('payment_intent.payment_failed');
  });

  it('rejects expired timestamp (>5min old)', () => {
    const secret = 'whsec_valid';
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400;
    const payload = JSON.stringify({ id: 'evt_123', type: 'test.event' });
    const signature = buildSignature(secret, payload, oldTimestamp);

    expect(() =>
      provider.constructWebhookEvent(payload, signature, secret),
    ).toThrow(StripeApiError);
  });

  it('rejects invalid signature', () => {
    const secret = 'whsec_valid';
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ id: 'evt_123', type: 'test.event' });
    const signature = `t=${timestamp},v1=invalidsignature`;

    expect(() =>
      provider.constructWebhookEvent(payload, signature, secret),
    ).toThrow(StripeApiError);
  });

  it('rejects malformed signature header', () => {
    const payload = JSON.stringify({ id: 'evt_123' });
    expect(() =>
      provider.constructWebhookEvent(payload, 'bad-header', 'whsec_x'),
    ).toThrow(StripeApiError);
  });

  it('rejects invalid JSON payload', () => {
    const secret = 'whsec_valid';
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = 'not-json{';
    const signature = buildSignature(secret, payload, timestamp);

    expect(() =>
      provider.constructWebhookEvent(payload, signature, secret),
    ).toThrow(StripeApiError);
  });

  it('guards against length mismatch in timingSafeEqual (no RangeError)', () => {
    const secret = 'whsec_valid';
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ id: 'evt_123', type: 'test.event' });
    // Signature with mismatched length hex string
    const signature = `t=${timestamp},v1=abc`;

    expect(() =>
      provider.constructWebhookEvent(payload, signature, secret),
    ).toThrow(StripeApiError);
  });

  it('returns event with id and type from payload', () => {
    const secret = 'whsec_valid';
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      id: 'evt_custom',
      type: 'checkout.session.completed',
      created: timestamp,
    });
    const signature = buildSignature(secret, payload, timestamp);

    const event = provider.constructWebhookEvent(payload, signature, secret);
    expect(event.id).toBe('evt_custom');
    expect(event.type).toBe('checkout.session.completed');
    expect(event.createdAt).toBe(new Date(timestamp * 1000).toISOString());
  });
});
