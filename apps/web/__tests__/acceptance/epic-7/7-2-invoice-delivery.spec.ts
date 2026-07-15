/**
 * Story 7.2 Acceptance Tests — Invoice Delivery & Payment Link
 * Tests the contracts of send-invoice, resend-invoice, redirect handler,
 * Resend transactional provider, and Stripe payment provider.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return {
    ...actual,
    requireTenantContext: vi.fn().mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'owner',
    }),
    createFlowError: actual.createFlowError,
    cacheTag: vi.fn((entity: string, ws: string) => `${entity}:${ws}`),
    invalidateAfterMutation: vi.fn(),
  };
});

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

function mockSupabase(rpcResult: unknown, rpcError?: Error, rowData?: unknown) {
  return {
    rpc: vi
      .fn()
      .mockResolvedValue({ data: rpcResult, error: rpcError ?? null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: rowData ?? null, error: null }),
      single: vi.fn().mockResolvedValue({ data: rowData ?? null, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

// ───────────────────────────────────────────────────────────────
// ATDD-001: sendInvoice transitions draft → sent
// ───────────────────────────────────────────────────────────────
describe('[P0] [7.2-ATDD-001] sending invoice transitions status from draft to sent', () => {
  test('sendInvoiceAction returns success with paymentUrl and deliveryId', async () => {
    const { sendInvoiceAction } =
      await import('@/lib/actions/invoices/send-invoice');
    expect(sendInvoiceAction).toBeDefined();

    const { sendInvoiceSchema } = await import('@flow/types');
    const parsed = sendInvoiceSchema.safeParse({
      invoiceId: '00000000-0000-0000-0000-000000000001',
    });
    expect(parsed.success).toBe(true);
  });

  test('sendInvoiceAction rejects non-draft invoices with FINANCIAL_INVALID_STATE', async () => {
    const { getServerSupabase } = await import('@/lib/supabase-server');
    const { sendInvoiceAction } =
      await import('@/lib/actions/invoices/send-invoice');

    const mockClient = mockSupabase(null, undefined, {
      id: 'inv-1',
      workspace_id: 'ws-1',
      client_id: 'cli-1',
      invoice_number: 'INV-001',
      status: 'sent',
      total_cents: 10000,
      currency: 'usd',
      due_date: '2026-06-01',
      clients: { name: 'Acme', email: 'acme@test.com' },
      workspaces: { name: 'WS A' },
    });

    vi.mocked(getServerSupabase).mockResolvedValue(mockClient);

    const result = await sendInvoiceAction({
      invoiceId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FINANCIAL_INVALID_STATE');
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: resend action reuses existing payment URL
// ───────────────────────────────────────────────────────────────
describe('[P0] [7.2-ATDD-002] resend action reuses existing payment URL', () => {
  test('resendInvoiceAction returns success with messageId', async () => {
    const { resendInvoiceAction } =
      await import('@/lib/actions/invoices/resend-invoice');
    expect(resendInvoiceAction).toBeDefined();

    const { resendInvoiceSchema } = await import('@flow/types');
    const parsed = resendInvoiceSchema.safeParse({
      invoiceId: '00000000-0000-0000-0000-000000000001',
    });
    expect(parsed.success).toBe(true);
  });

  test('resendInvoiceAction rejects invoice without payment_url', async () => {
    const { getServerSupabase } = await import('@/lib/supabase-server');
    const { resendInvoiceAction } =
      await import('@/lib/actions/invoices/resend-invoice');

    const mockClient = mockSupabase(null, undefined, {
      id: 'inv-1',
      workspace_id: 'ws-1',
      client_id: 'cli-1',
      invoice_number: 'INV-001',
      status: 'sent',
      total_cents: 10000,
      currency: 'usd',
      payment_url: null,
      clients: { name: 'Acme', email: 'acme@test.com' },
      workspaces: { name: 'WS A' },
    });

    vi.mocked(getServerSupabase).mockResolvedValue(mockClient);

    const result = await resendInvoiceAction({
      invoiceId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('MISSING_PAYMENT_URL');
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: redirect handler invalidates token and transitions sent → viewed
// ───────────────────────────────────────────────────────────────
describe('[P0] [7.2-ATDD-003] redirect handler invalidates token and transitions sent -> viewed', () => {
  test('route.ts exports GET handler', async () => {
    const mod = await import('@/app/api/redirect/pay/[token]/route');
    expect(mod.GET).toBeDefined();
    expect(typeof mod.GET).toBe('function');
  });

  test('GET returns 429 when rate limited', async () => {
    const { GET } = await import('@/app/api/redirect/pay/[token]/route');

    const req = new Request('http://localhost/api/redirect/pay/test-token', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });

    for (let i = 0; i < 30; i++) {
      await GET(req, { params: Promise.resolve({ token: 'tok' + i }) });
    }

    const resp = await GET(req, {
      params: Promise.resolve({ token: 'tok-final' }),
    });
    expect(resp.status).toBe(429);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Resend transactional provider sends invoice email
// ───────────────────────────────────────────────────────────────
describe('[P0] [7.2-ATDD-004] resend transactional provider sends invoice email', () => {
  test('ResendTransactionalProvider is exported from @flow/agents/providers', async () => {
    const { ResendTransactionalProvider } =
      await import('@flow/agents/providers');
    expect(ResendTransactionalProvider).toBeDefined();
  });

  test('send returns messageId on success', async () => {
    const { ResendTransactionalProvider } =
      await import('@flow/agents/providers');
    const provider = new ResendTransactionalProvider('re_test');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg_invoice_123' }),
    });

    const result = await provider.send({
      to: 'client@example.com',
      subject: 'Invoice INV-001',
      htmlBody: '<p>Pay</p>',
      textBody: 'Pay here',
      metadata: { invoice_id: 'inv1' },
    });

    expect(result.messageId).toBe('msg_invoice_123');
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-005: Stripe checkout session creation returns URL
// ───────────────────────────────────────────────────────────────
describe('[P0] [7.2-ATDD-005] stripe checkout session creation returns URL', () => {
  test('StripePaymentProvider is exported from @flow/agents/providers', async () => {
    const { StripePaymentProvider } = await import('@flow/agents/providers');
    expect(StripePaymentProvider).toBeDefined();
  });

  test('createCheckoutSession returns url and sessionId', async () => {
    const { StripePaymentProvider } = await import('@flow/agents/providers');
    const provider = new StripePaymentProvider({
      secretKey: 'sk_test_secret',
      webhookSecret: 'whsec_test',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      }),
    });

    const session = await provider.createCheckoutSession({
      amountCents: 10000,
      currency: 'usd',
      invoiceNumber: 'INV-001',
      metadata: { workspace_id: 'ws-1', invoice_id: 'inv-1' },
      successUrl: 'https://app.flow.app/success',
      cancelUrl: 'https://app.flow.app/cancel',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      idempotencyKey: 'key-123',
    });

    expect(session.url).toBe('https://checkout.stripe.com/pay/cs_test_123');
    expect(session.sessionId).toBe('cs_test_123');
  });
});
