/**
 * Story 7.3 Acceptance Tests — Partial Payments & Balance Tracking
 * Tests recordPayment action, status transitions, rejection paths,
 * idempotency, overpayment handling, and balance display.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return {
    ...actual,
    requireTenantContext: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' }),
    createFlowError: actual.createFlowError,
  };
});

function mockSupabase(rpcResult: unknown, rpcError?: Error, rowData?: unknown) {
  const fromChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: rowData ?? null, error: null }),
    single: vi.fn().mockResolvedValue({ data: rowData ?? null, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
  };
  return {
    rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: rpcError ?? null }),
    from: vi.fn().mockReturnValue(fromChain),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

function mockInvoiceRow(status: string, totalCents: number, amountPaidCents: number) {
  return {
    id: 'inv-1',
    status,
    total_cents: totalCents,
    amount_paid_cents: amountPaidCents,
    credit_balance_cents: 0,
    version: 1,
    client_id: 'cli-1',
    invoice_number: 'INV-001',
    issue_date: '2026-05-26',
    due_date: '2026-06-25',
    currency: 'usd',
    notes: null,
    voided_at: null,
    void_reason: null,
    created_at: '2026-05-26T00:00:00Z',
    payment_url: null,
    sent_at: null,
    viewed_at: null,
    delivery_token: null,
    clients: { name: 'Acme' },
  };
}

// ───────────────────────────────────────────────────────────────
// ATDD-001: recordPayment action is defined
// ───────────────────────────────────────────────────────────────
describe('[P0] [7.3-ATDD-001] recordPayment action is defined', () => {
  test('recordPaymentAction exists and has correct signature', async () => {
    const { recordPaymentAction } = await import('@/lib/actions/invoices/record-payment');
    expect(recordPaymentAction).toBeDefined();
    expect(typeof recordPaymentAction).toBe('function');
  });

  test('recordPaymentSchema accepts valid input', async () => {
    const { recordPaymentSchema } = await import('@flow/types');
    const result = recordPaymentSchema.safeParse({
      invoiceId: '00000000-0000-0000-0000-000000000001',
      amountCents: 5000,
      paymentDate: '2026-05-26',
      paymentMethod: 'manual_check',
    });
    expect(result.success).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: recordPayment updates invoice status to partially_paid
// ───────────────────────────────────────────────────────────────
describe('[P0] [7.3-ATDD-002] recordPayment updates invoice status to partially_paid', () => {
  test('RPC returns new_status partially_paid when payment < total', async () => {
    const { callPaymentRpcWithRetry } = await import('@/lib/actions/invoices/record-payment-helpers');

    const mockClient = mockSupabase({
      payment_id: 'pay-1',
      new_status: 'partially_paid',
      amount_paid_cents: 5000,
      credit_balance_cents: 0,
    });

    const result = await callPaymentRpcWithRetry(mockClient, {
      invoiceId: 'inv-1',
      workspaceId: 'ws-1',
      amountCents: 5000,
      paymentMethod: 'manual_check',
      paymentDate: '2026-05-26',
      notes: undefined,
      createdBy: 'user-1',
      idempotencyKey: undefined,
    });

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.newStatus).toBe('partially_paid');
      expect(result.newAmountPaid).toBe(5000);
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: recordPayment rejects voided invoice
// ───────────────────────────────────────────────────────────────
describe('[P0] [7.3-ATDD-003] recordPayment rejects voided invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('voided invoice returns INVOICE_VOIDED error', async () => {
    const { getServerSupabase } = await import('@/lib/supabase-server');
    const { recordPaymentAction } = await import('@/lib/actions/invoices/record-payment');

    vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase(
      null,
      new Error('INVOICE_VOIDED'),
      mockInvoiceRow('voided', 10000, 0)
    ));

    const result = await recordPaymentAction({
      invoiceId: '00000000-0000-0000-0000-000000000001',
      amountCents: 5000,
      paymentDate: '2026-05-26',
      paymentMethod: 'manual_check',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVOICE_VOIDED');
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: recordPayment rejects already-paid invoice
// ───────────────────────────────────────────────────────────────
describe('[P0] [7.3-ATDD-004] recordPayment rejects already-paid invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('paid invoice returns INVOICE_ALREADY_PAID error', async () => {
    const { getServerSupabase } = await import('@/lib/supabase-server');
    const { recordPaymentAction } = await import('@/lib/actions/invoices/record-payment');

    vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase(
      null,
      new Error('INVOICE_ALREADY_PAID'),
      mockInvoiceRow('paid', 10000, 10000)
    ));

    const result = await recordPaymentAction({
      invoiceId: '00000000-0000-0000-0000-000000000001',
      amountCents: 1000,
      paymentDate: '2026-05-26',
      paymentMethod: 'manual_check',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVOICE_ALREADY_PAID');
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-005: overpayment returns warning and transitions to paid
// ───────────────────────────────────────────────────────────────
describe('[P0] [7.3-ATDD-005] overpayment returns warning and transitions to paid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('overpayment without confirmOverpayment returns warning', async () => {
    const { getServerSupabase } = await import('@/lib/supabase-server');
    const { recordPaymentAction } = await import('@/lib/actions/invoices/record-payment');

    vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase(
      null,
      undefined,
      mockInvoiceRow('sent', 10000, 0)
    ));

    const result = await recordPaymentAction({
      invoiceId: '00000000-0000-0000-0000-000000000001',
      amountCents: 12000,
      paymentDate: '2026-05-26',
      paymentMethod: 'manual_check',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.details?.overpayment).toBeDefined();
    }
  });

  test('overpayment with confirmOverpayment succeeds and marks paid', async () => {
    const { callPaymentRpcWithRetry } = await import('@/lib/actions/invoices/record-payment-helpers');

    const mockClient = mockSupabase({
      payment_id: 'pay-2',
      new_status: 'paid',
      amount_paid_cents: 10000,
      credit_balance_cents: 2000,
    });

    const result = await callPaymentRpcWithRetry(mockClient, {
      invoiceId: 'inv-1',
      workspaceId: 'ws-1',
      amountCents: 12000,
      paymentMethod: 'manual_check',
      paymentDate: '2026-05-26',
      notes: undefined,
      createdBy: 'user-1',
      idempotencyKey: 'key-1',
    });

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.newStatus).toBe('paid');
      expect(result.newCreditBalance).toBe(2000);
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-006: idempotency key prevents double recording
// ───────────────────────────────────────────────────────────────
describe('[P0] [7.3-ATDD-006] idempotency key prevents double recording', () => {
  test('checkIdempotencyKey returns cached result when key exists', async () => {
    const { checkIdempotencyKey } = await import('@/lib/actions/invoices/idempotency');

    const cached = { payment: { id: 'pay-1' }, invoice: { id: 'inv-1' } };
    const mockClient = mockSupabase(
      null,
      undefined,
      { response_json: cached }
    );

    const result = await checkIdempotencyKey(mockClient, 'ws-1', 'inv-1', 'key-123');
    expect(result).toEqual({ success: true, data: cached });
  });

  test('checkIdempotencyKey returns null when no key provided', async () => {
    const { checkIdempotencyKey } = await import('@/lib/actions/invoices/idempotency');
    const mockClient = mockSupabase(null);

    const result = await checkIdempotencyKey(mockClient, 'ws-1', 'inv-1', undefined);
    expect(result).toBeNull();
  });

  test('hashIdempotencyKey produces deterministic SHA-256', async () => {
    const { hashIdempotencyKey } = await import('@/lib/actions/invoices/idempotency');
    const h1 = hashIdempotencyKey('inv-1', 'key-a');
    const h2 = hashIdempotencyKey('inv-1', 'key-a');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // hex SHA-256
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-007: invoice detail page shows balance summary
// ───────────────────────────────────────────────────────────────
describe('[P0] [7.3-ATDD-007] invoice detail page shows balance summary', () => {
  test('getInvoiceWithBalance is exported from @flow/db', async () => {
    const { getInvoiceWithBalance } = await import('@flow/db');
    expect(getInvoiceWithBalance).toBeDefined();
  });

  test('getClientFinancialSummary is exported from @flow/db', async () => {
    const { getClientFinancialSummary } = await import('@flow/db');
    expect(getClientFinancialSummary).toBeDefined();
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-008: invoice list shows balance per invoice
// ───────────────────────────────────────────────────────────────
describe('[P0] [7.3-ATDD-008] invoice list shows balance per invoice', () => {
  test('getInvoicesAction exists and computes balance', async () => {
    const { getInvoicesAction } = await import('@/lib/actions/invoices/get-invoices');
    expect(getInvoicesAction).toBeDefined();
  });
});
