/**
 * Unit tests for checkInvoiceDuplicatesAction
 * Tests duplicate detection logic for retainer and time_entry line items.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Must mock before importing the module under test
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
  };
});

const { checkInvoiceDuplicatesAction } =
  await import('@/lib/actions/invoices/check-invoice-duplicates');

function mockSupabase(
  invoiceRows?: Array<Record<string, unknown>>,
  lineItemRows?: Array<Record<string, unknown>>,
) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi
            .fn()
            .mockResolvedValue({ data: invoiceRows ?? [], error: null }),
        };
      }
      if (table === 'invoice_line_items') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi
            .fn()
            .mockResolvedValue({ data: lineItemRows ?? [], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

describe('checkInvoiceDuplicatesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns empty array when no nearby invoices exist', async () => {
    const { getServerSupabase } = await import('@/lib/supabase-server');
    vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase([], []));

    const result = await checkInvoiceDuplicatesAction({
      clientId: '00000000-0000-0000-0000-000000000001',
      issueDate: '2026-05-26',
      lineItems: [
        {
          sourceType: 'retainer',
          retainerId: '00000000-0000-0000-0000-000000000002',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  test('returns duplicate warning when retainer line items match', async () => {
    const { getServerSupabase } = await import('@/lib/supabase-server');
    vi.mocked(getServerSupabase).mockResolvedValue(
      mockSupabase(
        [{ id: 'inv-dup-1', invoice_number: 'INV-2026-DUP' }],
        [
          {
            invoice_id: 'inv-dup-1',
            source_type: 'retainer',
            retainer_id: 'ret-1',
          },
        ],
      ),
    );

    const result = await checkInvoiceDuplicatesAction({
      clientId: '00000000-0000-0000-0000-000000000001',
      issueDate: '2026-05-26',
      lineItems: [
        {
          sourceType: 'retainer',
          retainerId: 'ret-1',
          description: 'Monthly retainer',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].invoiceNumber).toBe('INV-2026-DUP');
      expect(result.data[0].reason).toBe('soft');
      expect(result.data[0].matchingSourceIds).toContain('ret-1');
    }
  });

  test('returns duplicate warning when time_entry line items match', async () => {
    const { getServerSupabase } = await import('@/lib/supabase-server');
    vi.mocked(getServerSupabase).mockResolvedValue(
      mockSupabase(
        [{ id: 'inv-dup-2', invoice_number: 'INV-2026-TE' }],
        [
          {
            invoice_id: 'inv-dup-2',
            source_type: 'time_entry',
            time_entry_id: 'te-1',
          },
        ],
      ),
    );

    const result = await checkInvoiceDuplicatesAction({
      clientId: '00000000-0000-0000-0000-000000000001',
      issueDate: '2026-05-26',
      lineItems: [
        {
          sourceType: 'time_entry',
          timeEntryId: 'te-1',
          description: 'Dev work',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].invoiceNumber).toBe('INV-2026-TE');
      expect(result.data[0].matchingSourceIds).toContain('te-1');
    }
  });

  test('returns empty array when no line items match', async () => {
    const { getServerSupabase } = await import('@/lib/supabase-server');
    vi.mocked(getServerSupabase).mockResolvedValue(
      mockSupabase(
        [{ id: 'inv-dup-3', invoice_number: 'INV-2026-NOMATCH' }],
        [
          {
            invoice_id: 'inv-dup-3',
            source_type: 'retainer',
            retainer_id: 'ret-a',
          },
        ],
      ),
    );

    const result = await checkInvoiceDuplicatesAction({
      clientId: '00000000-0000-0000-0000-000000000001',
      issueDate: '2026-05-26',
      lineItems: [
        {
          sourceType: 'retainer',
          retainerId: 'ret-b',
          description: 'Different retainer',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  test('validates clientId UUID format', async () => {
    const result = await checkInvoiceDuplicatesAction({
      clientId: 'not-a-uuid',
      issueDate: '2026-05-26',
      lineItems: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('validates issueDate format', async () => {
    const result = await checkInvoiceDuplicatesAction({
      clientId: '00000000-0000-0000-0000-000000000001',
      issueDate: '26-05-2026',
      lineItems: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });
});
