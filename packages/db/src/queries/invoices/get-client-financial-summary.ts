import type { SupabaseClient } from '@supabase/supabase-js';

export interface ClientFinancialSummary {
  totalInvoicedCents: number;
  totalPaidCents: number;
  totalOutstandingCents: number;
  totalCreditCents: number;
  voidedCount: number;
}

export async function getClientFinancialSummary(
  client: SupabaseClient,
  clientId: string,
  workspaceId: string,
): Promise<ClientFinancialSummary> {
  const { data, error } = await client
    .from('invoices')
    .select('total_cents, amount_paid_cents, credit_balance_cents, status')
    .eq('client_id', clientId)
    .eq('workspace_id', workspaceId);

  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  let totalInvoicedCents = 0;
  let totalPaidCents = 0;
  let totalOutstandingCents = 0;
  let totalCreditCents = 0;
  let voidedCount = 0;

  for (const r of rows) {
    const total = Number(r.total_cents ?? 0);
    const paid = Number(r.amount_paid_cents ?? 0);
    const credit = Number(r.credit_balance_cents ?? 0);
    const status = String(r.status ?? '');

    totalPaidCents += paid;

    if (status !== 'voided') {
      totalInvoicedCents += total;
      totalCreditCents += credit;
    }

    if (status !== 'voided' && status !== 'paid') {
      totalOutstandingCents += Math.max(total - paid - credit, 0);
    }

    if (status === 'voided') {
      voidedCount += 1;
    }
  }

  return {
    totalInvoicedCents,
    totalPaidCents,
    totalOutstandingCents,
    totalCreditCents,
    voidedCount,
  };
}
