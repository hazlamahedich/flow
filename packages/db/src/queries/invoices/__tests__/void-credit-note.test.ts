import { describe, it, expect, vi } from 'vitest';
import { voidInvoiceViaRpc } from '../void-invoice';
import { issueCreditNoteViaRpc } from '../issue-credit-note';
import { getClientFinancialSummary } from '../get-client-financial-summary';

function mockSupabase(rpcResult: unknown, rpcError?: Error) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: rpcError ?? null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  } as unknown as Parameters<typeof voidInvoiceViaRpc>[0];
}

describe('voidInvoiceViaRpc', () => {
  it('returns success when RPC returns success', async () => {
    const client = mockSupabase({
      success: true,
      status: 'voided',
      time_entries_cleared: 2,
    });

    const result = await voidInvoiceViaRpc(client, 'inv-1', 'ws-1', 'Client cancelled');
    expect(result).toEqual({
      success: true,
      status: 'voided',
      timeEntriesCleared: 2,
    });
  });

  it('returns null when RPC returns error', async () => {
    const client = mockSupabase({ error: 'INVOICE_PAID_CANNOT_VOID' });
    const result = await voidInvoiceViaRpc(client, 'inv-1', 'ws-1', 'reason');
    expect(result).toBeNull();
  });

  it('returns success when invoice is already voided (idempotent noop)', async () => {
    const client = mockSupabase({
      success: true,
      status: 'voided',
      prior_status: 'voided',
      time_entries_cleared: 0,
    });
    const result = await voidInvoiceViaRpc(client, 'inv-1', 'ws-1', 'reason');
    expect(result?.success).toBe(true);
    expect(result?.timeEntriesCleared).toBe(0);
  });
});

describe('issueCreditNoteViaRpc', () => {
  it('returns credit note result on success', async () => {
    const client = mockSupabase({
      credit_note_id: 'cn-1',
      new_credit_balance_cents: 500,
      line_item_sort_order: 3,
    });

    const result = await issueCreditNoteViaRpc(client, 'inv-1', 'ws-1', 500, 'Overcharge', 'user-1');
    expect(result).toEqual({
      creditNoteId: 'cn-1',
      newCreditBalanceCents: 500,
      lineItemSortOrder: 3,
    });
  });

  it('returns null when RPC returns error', async () => {
    const client = mockSupabase({ error: 'CREDIT_EXCEEDS_BALANCE' });
    const result = await issueCreditNoteViaRpc(client, 'inv-1', 'ws-1', 5000, 'Too much', 'user-1');
    expect(result).toBeNull();
  });
});

describe('getClientFinancialSummary', () => {
  it('computes correct aggregates from invoice rows', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { total_cents: 10000, amount_paid_cents: 5000, credit_balance_cents: 0, status: 'sent' },
                { total_cents: 20000, amount_paid_cents: 20000, credit_balance_cents: 0, status: 'paid' },
                { total_cents: 5000, amount_paid_cents: 0, credit_balance_cents: 500, status: 'draft' },
                { total_cents: 3000, amount_paid_cents: 1000, credit_balance_cents: 0, status: 'voided' },
              ],
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof getClientFinancialSummary>[0];

    const result = await getClientFinancialSummary(client, 'c-1', 'ws-1');
    expect(result.totalInvoicedCents).toBe(35000); // excludes voided 3000
    expect(result.totalPaidCents).toBe(26000);     // 5000 + 20000 + 0 + 1000
    expect(result.totalOutstandingCents).toBe(9500);
    // sent: total 10000, paid 5000, credit 0 => outstanding 5000
    // paid: excluded
    // draft: total 5000, paid 0, credit 500 => outstanding 4500
    // voided: excluded
    // total outstanding = 5000 + 4500 = 9500
    expect(result.totalCreditCents).toBe(500); // excludes voided (voided has 0 credit anyway)
    expect(result.voidedCount).toBe(1);
  });
});
