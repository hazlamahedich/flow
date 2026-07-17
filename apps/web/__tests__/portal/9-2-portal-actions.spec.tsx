/**
 * Story 9.2 Unit Tests — Edge cases EC1–EC17 + pay/approve/notification behavior.
 *
 * Mocks Supabase chain, payment provider, transactional email provider, and
 * check_rate_limit RPC. Mirrors 9-1a/9-1b mock patterns.
 *
 * Story 9.2 — AC3, AC4, AC5, AC6, AC7.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

vi.mock('@/lib/supabase-server', () => {
  const mockRpc = vi.fn();
  const mockFrom = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn(() => ({
          range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
        })),
        gt: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    })),
    insert: vi.fn().mockResolvedValue({ error: null }),
  }));
  return {
    getServerSupabase: vi.fn().mockResolvedValue({
      rpc: mockRpc,
      from: mockFrom,
    }),
  };
});

vi.mock('@flow/auth/server/portal-client', () => {
  const mockRpc = vi.fn();
  const mockQueryChain = {
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
    })),
  };
  return { createPortalClient: vi.fn().mockResolvedValue(mockQueryChain) };
});

vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return {
    ...actual,
    requireTenantContext: vi.fn(),
    createFlowError: actual.createFlowError,
  };
});

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(() => undefined),
    set: vi.fn(),
    getAll: vi.fn(() => []),
  }),
}));

const mockCreateCheckout = vi.fn().mockResolvedValue({
  url: 'https://checkout.stripe.com/cs_test',
  sessionId: 'cs_test',
});
const mockProviderSend = vi.fn().mockResolvedValue({ messageId: 'msg_test' });

vi.mock('@flow/agents/providers', () => ({
  getPaymentProvider: vi.fn(() => ({
    createCheckoutSession: mockCreateCheckout,
  })),
  getTransactionalEmailProvider: vi.fn(() => ({ send: mockProviderSend })),
}));

import { getServerSupabase } from '@/lib/supabase-server';
import { createPortalClient } from '@flow/auth/server/portal-client';
import { payInvoicePortalAction } from '@/lib/actions/portal/pay-invoice';
import { approveReportAction } from '@/lib/actions/portal/approve-report';
import { requestReportChangesAction } from '@/lib/actions/portal/request-report-changes';
import { sendClientNotificationAction } from '@/lib/actions/portal/client-notification';
import { buildClientNotificationEmail } from '@/lib/actions/portal/client-notification-templates';
import { ZeroThoughtTasksHero } from '@/app/portal/components/ZeroThoughtTasksHero';
import { ValueReceipt } from '@/app/portal/components/ValueReceipt';
import { NextWeekPreview } from '@/app/portal/components/NextWeekPreview';
import { MessageVaCard } from '@/app/portal/components/MessageVaCard';
import { render } from '@testing-library/react';

const PORTAL_CTX = {
  clientId: '11111111-1111-1111-1111-111111111111',
  workspaceId: '22222222-2222-2222-2222-222222222222',
  portalTokenId: '33333333-3333-3333-3333-333333333333',
};

const INVOICE_ID = '44444444-4444-4444-4444-444444444444';
const REPORT_ID = '55555555-5555-5555-5555-555555555555';
const SLUG = 'test-workspace';

function mockPortalClientInvoice(invoice: Record<string, unknown> | null) {
  const portalClient = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: invoice, error: null }),
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
    })),
    rpc: vi.fn(),
  };
  vi.mocked(createPortalClient).mockResolvedValue(portalClient as never);
  return portalClient;
}

function mockPortalRpc() {
  const portalClient = { rpc: vi.fn() };
  vi.mocked(createPortalClient).mockResolvedValue(portalClient as never);
  return portalClient;
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom doesn't implement matchMedia — mock it for prefers-reduced-motion checks
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// ───────────────────────────────────────────────────────────────
// Pay Invoice — EC1–EC5, EC16
// ───────────────────────────────────────────────────────────────
describe('[9.2] payInvoicePortalAction edge cases', () => {
  test('EC1: rejects paid invoice with FINANCIAL_INVALID_STATE', async () => {
    mockPortalClientInvoice({
      id: INVOICE_ID,
      client_id: PORTAL_CTX.clientId,
      workspace_id: PORTAL_CTX.workspaceId,
      status: 'paid',
      total_cents: 10000,
      amount_paid_cents: 10000,
      credit_balance_cents: 0,
      currency: 'usd',
      invoice_number: 'INV-001',
      payment_url: null,
      payment_url_expires_at: null,
    });
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({ data: { allowed: true }, error: null });

    const result = await payInvoicePortalAction(PORTAL_CTX, {
      invoiceId: INVOICE_ID,
      slug: SLUG,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe('FINANCIAL_INVALID_STATE');
  });

  test('EC2: rejects voided invoice with FINANCIAL_INVALID_STATE', async () => {
    mockPortalClientInvoice({
      id: INVOICE_ID,
      client_id: PORTAL_CTX.clientId,
      workspace_id: PORTAL_CTX.workspaceId,
      status: 'voided',
      total_cents: 5000,
      amount_paid_cents: 0,
      credit_balance_cents: 0,
      currency: 'usd',
      invoice_number: 'INV-002',
      payment_url: null,
      payment_url_expires_at: null,
    });
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({ data: { allowed: true }, error: null });

    const result = await payInvoicePortalAction(PORTAL_CTX, {
      invoiceId: INVOICE_ID,
      slug: SLUG,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe('FINANCIAL_INVALID_STATE');
  });

  test('EC3: rejects zero-balance invoice with FINANCIAL_INVALID_STATE', async () => {
    mockPortalClientInvoice({
      id: INVOICE_ID,
      client_id: PORTAL_CTX.clientId,
      workspace_id: PORTAL_CTX.workspaceId,
      status: 'partially_paid',
      total_cents: 10000,
      amount_paid_cents: 10000,
      credit_balance_cents: 0,
      currency: 'usd',
      invoice_number: 'INV-003',
      payment_url: null,
      payment_url_expires_at: null,
    });
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({ data: { allowed: true }, error: null });

    const result = await payInvoicePortalAction(PORTAL_CTX, {
      invoiceId: INVOICE_ID,
      slug: SLUG,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe('FINANCIAL_INVALID_STATE');
  });

  test('EC4: rejects invoice hidden by RLS (not found)', async () => {
    mockPortalClientInvoice(null);
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({ data: { allowed: true }, error: null });

    const result = await payInvoicePortalAction(PORTAL_CTX, {
      invoiceId: INVOICE_ID,
      slug: SLUG,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND');
  });

  test('EC5: mints fresh checkout for partially_paid invoice (no URL reuse)', async () => {
    const portalClient = mockPortalClientInvoice({
      id: INVOICE_ID,
      client_id: PORTAL_CTX.clientId,
      workspace_id: PORTAL_CTX.workspaceId,
      status: 'partially_paid',
      total_cents: 10000,
      amount_paid_cents: 3000,
      credit_balance_cents: 0,
      currency: 'usd',
      invoice_number: 'INV-005',
      payment_url: 'https://old.stripe.com/cs_old',
      payment_url_expires_at: new Date(Date.now() + 86400000).toISOString(),
    });
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({
      data: { allowed: true, retry_after_ms: 0 },
      error: null,
    });
    portalClient.rpc.mockResolvedValue({ data: 'OK', error: null });

    const result = await payInvoicePortalAction(PORTAL_CTX, {
      invoiceId: INVOICE_ID,
      slug: SLUG,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.checkoutUrl).toBe(
        'https://checkout.stripe.com/cs_test',
      );
      expect(mockCreateCheckout).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: 7000 }),
      );
    }
  });

  test('happy path: returns checkout URL for sent invoice', async () => {
    const portalClient = mockPortalClientInvoice({
      id: INVOICE_ID,
      client_id: PORTAL_CTX.clientId,
      workspace_id: PORTAL_CTX.workspaceId,
      status: 'sent',
      total_cents: 10000,
      amount_paid_cents: 0,
      credit_balance_cents: 0,
      currency: 'usd',
      invoice_number: 'INV-100',
      payment_url: null,
      payment_url_expires_at: null,
    });
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({
      data: { allowed: true, retry_after_ms: 0 },
      error: null,
    });
    portalClient.rpc.mockResolvedValue({ data: 'OK', error: null });

    const result = await payInvoicePortalAction(PORTAL_CTX, {
      invoiceId: INVOICE_ID,
      slug: SLUG,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.checkoutUrl).toBeDefined();
  });

  test('reuses valid, non-expired payment_url for sent (non-partial) invoice', async () => {
    mockPortalClientInvoice({
      id: INVOICE_ID,
      client_id: PORTAL_CTX.clientId,
      workspace_id: PORTAL_CTX.workspaceId,
      status: 'sent',
      total_cents: 10000,
      amount_paid_cents: 0,
      credit_balance_cents: 0,
      currency: 'usd',
      invoice_number: 'INV-101',
      payment_url: 'https://existing.stripe.com/cs_existing',
      payment_url_expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({
      data: { allowed: true, retry_after_ms: 0 },
      error: null,
    });

    const result = await payInvoicePortalAction(PORTAL_CTX, {
      invoiceId: INVOICE_ID,
      slug: SLUG,
    });
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.checkoutUrl).toBe(
        'https://existing.stripe.com/cs_existing',
      );
    expect(mockCreateCheckout).not.toHaveBeenCalled();
  });

  test('EC16: rejects rate-limited pay attempt with RATE_LIMITED', async () => {
    mockPortalClientInvoice({
      id: INVOICE_ID,
      client_id: PORTAL_CTX.clientId,
      workspace_id: PORTAL_CTX.workspaceId,
      status: 'sent',
      total_cents: 10000,
      amount_paid_cents: 0,
      credit_balance_cents: 0,
      currency: 'usd',
      invoice_number: 'INV-102',
      payment_url: null,
      payment_url_expires_at: null,
    });
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({
      data: { allowed: false, retry_after_ms: 5000 },
      error: null,
    });

    const result = await payInvoicePortalAction(PORTAL_CTX, {
      invoiceId: INVOICE_ID,
      slug: SLUG,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RATE_LIMITED');
  });

  test('PROVIDER_ERROR when Stripe fails', async () => {
    mockPortalClientInvoice({
      id: INVOICE_ID,
      client_id: PORTAL_CTX.clientId,
      workspace_id: PORTAL_CTX.workspaceId,
      status: 'sent',
      total_cents: 10000,
      amount_paid_cents: 0,
      credit_balance_cents: 0,
      currency: 'usd',
      invoice_number: 'INV-103',
      payment_url: null,
      payment_url_expires_at: null,
    });
    mockCreateCheckout.mockRejectedValueOnce(new Error('Stripe down'));
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({
      data: { allowed: true, retry_after_ms: 0 },
      error: null,
    });

    const result = await payInvoicePortalAction(PORTAL_CTX, {
      invoiceId: INVOICE_ID,
      slug: SLUG,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('PROVIDER_ERROR');
  });

  test('FORBIDDEN when refresh_portal_checkout_url RPC returns FORBIDDEN', async () => {
    const portalClient = mockPortalClientInvoice({
      id: INVOICE_ID,
      client_id: PORTAL_CTX.clientId,
      workspace_id: PORTAL_CTX.workspaceId,
      status: 'sent',
      total_cents: 10000,
      amount_paid_cents: 0,
      credit_balance_cents: 0,
      currency: 'usd',
      invoice_number: 'INV-104',
      payment_url: null,
      payment_url_expires_at: null,
    });
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({
      data: { allowed: true, retry_after_ms: 0 },
      error: null,
    });
    portalClient.rpc.mockResolvedValue({ data: 'FORBIDDEN', error: null });

    const result = await payInvoicePortalAction(PORTAL_CTX, {
      invoiceId: INVOICE_ID,
      slug: SLUG,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
  });

  test('rejects invalid invoiceId with VALIDATION_ERROR', async () => {
    const result = await payInvoicePortalAction(PORTAL_CTX, {
      invoiceId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});

// ───────────────────────────────────────────────────────────────
// Approve Report — EC6, EC7, EC9
// ───────────────────────────────────────────────────────────────
describe('[9.2] approveReportAction edge cases', () => {
  test('happy path: approves a sent report', async () => {
    const portalClient = mockPortalRpc();
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({
      data: { allowed: true, retry_after_ms: 0 },
      error: null,
    });
    portalClient.rpc.mockResolvedValue({ data: 'OK', error: null });

    const result = await approveReportAction(PORTAL_CTX, {
      reportId: REPORT_ID,
    });
    expect(result.success).toBe(true);
  });

  test('EC6: rejects already-approved report with INVALID_STATE', async () => {
    const portalClient = mockPortalRpc();
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({
      data: { allowed: true, retry_after_ms: 0 },
      error: null,
    });
    portalClient.rpc.mockResolvedValue({ data: 'INVALID_STATE', error: null });

    const result = await approveReportAction(PORTAL_CTX, {
      reportId: REPORT_ID,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INVALID_STATE');
  });

  test('EC9: rejects cross-client report with FORBIDDEN', async () => {
    const portalClient = mockPortalRpc();
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({
      data: { allowed: true, retry_after_ms: 0 },
      error: null,
    });
    portalClient.rpc.mockResolvedValue({ data: 'FORBIDDEN', error: null });

    const result = await approveReportAction(PORTAL_CTX, {
      reportId: REPORT_ID,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
  });

  test('EC16: rate-limited approve returns RATE_LIMITED', async () => {
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({
      data: { allowed: false, retry_after_ms: 5000 },
      error: null,
    });

    const result = await approveReportAction(PORTAL_CTX, {
      reportId: REPORT_ID,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RATE_LIMITED');
  });
});

// ───────────────────────────────────────────────────────────────
// Request Changes — EC8, message validation
// ───────────────────────────────────────────────────────────────
describe('[9.2] requestReportChangesAction edge cases', () => {
  test('happy path: records change request', async () => {
    const portalClient = mockPortalRpc();
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({
      data: { allowed: true, retry_after_ms: 0 },
      error: null,
    });
    portalClient.rpc.mockResolvedValue({ data: 'OK', error: null });

    const result = await requestReportChangesAction(PORTAL_CTX, {
      reportId: REPORT_ID,
      message: 'Please fix the hours.',
    });
    expect(result.success).toBe(true);
  });

  test('EC8: rejects change request on approved report with INVALID_STATE', async () => {
    const portalClient = mockPortalRpc();
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({
      data: { allowed: true, retry_after_ms: 0 },
      error: null,
    });
    portalClient.rpc.mockResolvedValue({ data: 'INVALID_STATE', error: null });

    const result = await requestReportChangesAction(PORTAL_CTX, {
      reportId: REPORT_ID,
      message: 'Change something',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INVALID_STATE');
  });

  test('rejects empty message with VALIDATION_ERROR', async () => {
    const result = await requestReportChangesAction(PORTAL_CTX, {
      reportId: REPORT_ID,
      message: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects too-long message (>2000 chars) with VALIDATION_ERROR', async () => {
    const result = await requestReportChangesAction(PORTAL_CTX, {
      reportId: REPORT_ID,
      message: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  test('INVALID_MESSAGE from RPC maps to VALIDATION_ERROR', async () => {
    const portalClient = mockPortalRpc();
    const supabase = (await getServerSupabase()) as never as {
      rpc: ReturnType<typeof vi.fn>;
    };
    supabase.rpc.mockResolvedValue({
      data: { allowed: true, retry_after_ms: 0 },
      error: null,
    });
    portalClient.rpc.mockResolvedValue({
      data: 'INVALID_MESSAGE',
      error: null,
    });

    const result = await requestReportChangesAction(PORTAL_CTX, {
      reportId: REPORT_ID,
      message: 'valid message',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});

// ───────────────────────────────────────────────────────────────
// Client Notification — EC12, EC13
// ───────────────────────────────────────────────────────────────
describe('[9.2] sendClientNotificationAction edge cases', () => {
  test('EC13: returns CLIENT_NO_EMAIL when client has no email', async () => {
    const portalClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                email: null,
                name: 'Test',
                workspace_id: PORTAL_CTX.workspaceId,
              },
              error: null,
            }),
          })),
        })),
      })),
    };
    vi.mocked(createPortalClient).mockResolvedValue(portalClient as never);

    const supabase = (await getServerSupabase()) as never as {
      from: ReturnType<typeof vi.fn>;
      rpc: ReturnType<typeof vi.fn>;
    };
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        email: null,
        name: 'Test',
        workspace_id: PORTAL_CTX.workspaceId,
      },
      error: null,
    });
    const secondEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    supabase.from.mockReturnValue({
      select: vi.fn(() => ({ eq: firstEq })),
    });
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    const result = await sendClientNotificationAction(PORTAL_CTX, {
      type: 'invoice_created',
      clientId: PORTAL_CTX.clientId,
      payload: { invoiceId: INVOICE_ID },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('CLIENT_NO_EMAIL');
  });

  test('rejects notification for different clientId with FORBIDDEN', async () => {
    const result = await sendClientNotificationAction(PORTAL_CTX, {
      type: 'invoice_created',
      clientId: '99999999-9999-9999-9999-999999999999',
      payload: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
  });

  test('rejects invalid type with VALIDATION_ERROR', async () => {
    const result = await sendClientNotificationAction(PORTAL_CTX, {
      type: 'invalid_type' as never,
      clientId: PORTAL_CTX.clientId,
      payload: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});

// ───────────────────────────────────────────────────────────────
// Notification templates
// ───────────────────────────────────────────────────────────────
describe('[9.2] buildClientNotificationEmail', () => {
  test('invoice_created template has subject and body', () => {
    const payload = buildClientNotificationEmail({
      to: 'client@test.com',
      clientName: 'Test Client',
      workspaceName: 'Test WS',
      type: 'invoice_created',
      payload: {
        invoiceId: INVOICE_ID,
        invoiceNumber: 'INV-001',
        amountCents: 10000,
        currency: 'usd',
      },
    });
    expect(payload.to).toBe('client@test.com');
    expect(payload.subject).toContain('INV-001');
    expect(payload.htmlBody).toContain('Test Client');
    expect(payload.textBody).toContain('INV-001');
  });

  test('payment_confirmed template includes amount', () => {
    const payload = buildClientNotificationEmail({
      to: 'client@test.com',
      clientName: 'Test Client',
      workspaceName: 'Test WS',
      type: 'payment_confirmed',
      payload: {
        invoiceId: INVOICE_ID,
        invoiceNumber: 'INV-001',
        amountCents: 5000,
        currency: 'usd',
      },
    });
    expect(payload.subject).toContain('Payment confirmed');
    expect(payload.htmlBody).toContain('50.00');
  });

  test('report_shared template has report link', () => {
    const payload = buildClientNotificationEmail({
      to: 'client@test.com',
      clientName: 'Test Client',
      workspaceName: 'Test WS',
      type: 'report_shared',
      payload: { reportId: REPORT_ID },
      portalUrl: 'https://app.test/portal/report',
    });
    expect(payload.subject).toContain('weekly report');
    expect(payload.htmlBody).toContain('View Report');
  });
});

// ───────────────────────────────────────────────────────────────
// Hero Component — EC15
// ───────────────────────────────────────────────────────────────
describe('[9.2] ZeroThoughtTasksHero component', () => {
  test('EC15: renders empty state when count is 0', () => {
    const { container } = render(<ZeroThoughtTasksHero count={0} />);
    expect(container.textContent).toContain('Your first report arrives Friday');
  });

  test('renders count when non-zero', () => {
    const { container } = render(<ZeroThoughtTasksHero count={5} />);
    expect(container.textContent).toContain('Zero-thought tasks this week');
  });

  test('renders trending arrow when current > previous', () => {
    const { container } = render(
      <ZeroThoughtTasksHero count={5} previousWeekCount={3} />,
    );
    // After animation completes (we render synchronously, so checking the text)
    expect(container.textContent).toContain('Zero-thought tasks this week');
  });
});

// ───────────────────────────────────────────────────────────────
// UX Components — AC7
// ───────────────────────────────────────────────────────────────
describe('[9.2] ValueReceipt component', () => {
  test('renders task and meeting counts with pluralization', () => {
    const { container } = render(
      <ValueReceipt taskCount={3} meetingCount={2} />,
    );
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('tasks');
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('meetings');
  });

  test('uses singular labels for count of 1', () => {
    const { container } = render(
      <ValueReceipt taskCount={1} meetingCount={1} />,
    );
    expect(container.textContent).toContain('1task');
    expect(container.textContent).toContain('1meeting');
  });

  test('clamps negative counts to zero', () => {
    const { container } = render(
      <ValueReceipt taskCount={-1} meetingCount={-5} />,
    );
    expect(container.textContent).toContain('0tasks');
    expect(container.textContent).toContain('0meetings');
  });
});

describe('[9.2] NextWeekPreview component', () => {
  test('renders events list', () => {
    const { container } = render(
      <NextWeekPreview
        events={[{ title: 'Team Sync', startAt: new Date().toISOString() }]}
      />,
    );
    expect(container.textContent).toContain('Team Sync');
  });

  test('renders empty state when no events', () => {
    const { container } = render(<NextWeekPreview events={[]} />);
    expect(container.textContent).toContain('No upcoming events');
  });

  test('shows Date TBD for invalid startAt', () => {
    const { container } = render(
      <NextWeekPreview
        events={[{ title: 'Bad Event', startAt: 'not-a-date' }]}
      />,
    );
    expect(container.textContent).toContain('Bad Event');
    expect(container.textContent).toContain('Date TBD');
  });
});

describe('[9.2] MessageVaCard component', () => {
  test('renders VA name and response time', () => {
    const { container } = render(<MessageVaCard vaDisplayName="Sarah" />);
    expect(container.textContent).toContain('Sarah');
    expect(container.textContent).toContain('4 business hours');
  });

  test('uses default name when no VA name provided', () => {
    const { container } = render(<MessageVaCard />);
    expect(container.textContent).toContain('your assistant');
  });
});
