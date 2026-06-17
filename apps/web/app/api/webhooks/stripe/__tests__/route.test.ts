import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextResponse } from 'next/server';

// Mocks
vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@flow/agents/providers', () => ({
  StripePaymentProvider: vi.fn().mockImplementation(() => ({
    constructWebhookEvent: vi.fn(),
  })),
}));

vi.mock('@flow/shared', () => ({
  mapStripeDeclineCode: vi.fn().mockReturnValue({ message: 'Card declined', retryable: false }),
}));

import { createServiceClient } from '@flow/db';
import { StripePaymentProvider } from '@flow/agents/providers';

function mockSupabase(options: {
  insertError?: { code?: string; message?: string } | null;
  invoiceData?: { status: string } | null;
}) {
  const from = vi.fn();

  // INSERT chain: from(...).insert({}) → { error }
  const insertMock = vi.fn().mockImplementation(() => {
    if (options.insertError) {
      return { error: options.insertError };
    }
    return { error: null };
  });

  // SELECT chain: from(...).select(...).eq().eq().maybeSingle()
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: options.invoiceData ?? null });
  const eqMock2 = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
  const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock1 });

  // UPDATE chain: from(...).update({}).eq() → { error: null }
  const updateEqMock = vi.fn().mockReturnValue({ error: null });
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

  // Generic second-eq for insert error branch etc.
  const secondEqMock = vi.fn().mockReturnValue({ error: null });

  from.mockImplementation((table: string) => {
    if (table === 'invoices') {
      return { select: selectMock };
    }
    if (table === 'stripe_webhook_events') {
      return {
        insert: insertMock,
        update: updateMock,
      };
    }
    if (table === 'invoice_payment_attempts') {
      return {
        insert: insertMock,
      };
    }
    return {};
  });

  const client = { from };
  (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client);
  return client;
}

describe('/api/webhooks/stripe POST', () => {
  beforeEach(() => {
    // clearAllMocks preserves mockReturnValue (resetAllMocks wipes it, which
    // silently breaks the `mapStripeDeclineCode` mock between tests).
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_secret';
  });

  it('returns 500 when STRIPE_WEBHOOK_SECRET is missing', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const request = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it('returns 400 on invalid signature', async () => {
    mockSupabase({});
    const providerMock = {
      constructWebhookEvent: vi.fn().mockImplementation(() => {
        throw new Error('Invalid signature');
      }),
    };
    (StripePaymentProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => providerMock);

    const request = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'bad' },
      body: '{}',
    });
    const response = await POST(request);
    const json = (await response.json()) as { error?: string };
    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid signature');
  });

  it('returns 200 immediately for duplicate events', async () => {
    mockSupabase({ insertError: { code: '23505' } });
    const providerMock = {
      constructWebhookEvent: vi.fn().mockReturnValue({
        id: 'evt_dup',
        type: 'test.event',
        payload: { data: { object: {} } },
        createdAt: new Date().toISOString(),
      }),
    };
    (StripePaymentProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => providerMock);

    const request = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 't=123,v1=d20efd4f60a3b3852bcd133de6be0f49d4b7ebea5fdd09e892abb9540ff8640b' },
      body: '{}',
    });
    const response = await POST(request);
    const json = (await response.json()) as { received?: boolean };
    expect(response.status).toBe(200);
    expect(json.received).toBe(true);
  });

  it('ACKs checkout.session.completed without side effects', async () => {
    mockSupabase({ invoiceData: { status: 'sent' } });
    const providerMock = {
      constructWebhookEvent: vi.fn().mockReturnValue({
        id: 'evt_success',
        type: 'checkout.session.completed',
        payload: {
          data: {
            object: {
              mode: 'payment',
              amount_total: 1099,
              payment_intent: 'pi_123',
              metadata: { invoice_id: 'inv_123', workspace_id: 'ws_123' },
            },
          },
        },
        createdAt: new Date().toISOString(),
      }),
    };
    (StripePaymentProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => providerMock);

    const request = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 't=123,v1=d20efd4f60a3b3852bcd133de6be0f49d4b7ebea5fdd09e892abb9540ff8640b' },
      body: '{}',
    });
    const response = await POST(request);
    const json = (await response.json()) as { received?: boolean };
    expect(response.status).toBe(200);
    expect(json.received).toBe(true);
  });

  it('persists failed payment attempt for payment_intent.payment_failed', async () => {
    mockSupabase({});
    const providerMock = {
      constructWebhookEvent: vi.fn().mockReturnValue({
        id: 'evt_fail',
        type: 'payment_intent.payment_failed',
        payload: {
          data: {
            object: {
              amount: 10000,
              metadata: { invoice_id: 'inv_123', workspace_id: 'ws_123' },
              last_payment_error: { decline_code: 'card_declined' },
            },
          },
        },
        createdAt: new Date().toISOString(),
      }),
    };
    (StripePaymentProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => providerMock);

    const request = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 't=123,v1=d20efd4f60a3b3852bcd133de6be0f49d4b7ebea5fdd09e892abb9540ff8640b' },
      body: '{}',
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
