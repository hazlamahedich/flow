import type { SupabaseClient } from '@supabase/supabase-js';

export interface GetInvoicesParams {
  workspaceId: string;
  page?: number;
  pageSize?: number;
}

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalCents: number;
  balanceCents: number;
  creditBalanceCents: number;
  currency: string;
  clientId: string;
  clientName: string;
  createdAt: string;
}

export async function getInvoices(
  client: SupabaseClient,
  params: GetInvoicesParams,
): Promise<{ invoices: InvoiceListItem[]; total: number }> {
  const page = Math.max(params.page ?? 1, 1);
  const pageSize = params.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [
    { count, error: countError },
    { data: rows, error: queryError },
  ] = await Promise.all([
    client
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', params.workspaceId),
    client
      .from('invoices')
      .select('id, invoice_number, status, issue_date, due_date, total_cents, amount_paid_cents, credit_balance_cents, currency, client_id, created_at, clients(name)')
      .eq('workspace_id', params.workspaceId)
      .order('created_at', { ascending: false })
      .range(from, to),
  ]);

  if (countError) throw countError;
  if (queryError) throw queryError;

  return {
    invoices: (rows ?? []).map((r: Record<string, unknown>) => {
      const total = Number(r.total_cents ?? 0);
      const paid = Number(r.amount_paid_cents ?? 0);
      return {
        id: r.id as string,
        invoiceNumber: r.invoice_number as string,
        status: r.status as string,
        issueDate: String(r.issue_date),
        dueDate: String(r.due_date),
        totalCents: total,
        balanceCents: Math.max(total - paid, 0),
        creditBalanceCents: Number(r.credit_balance_cents ?? 0),
        currency: r.currency as string,
        clientId: r.client_id as string,
        clientName: ((r.clients as Record<string, unknown> | null)?.name ?? '') as string,
        createdAt: String(r.created_at),
      };
    }),
    total: count ?? 0,
  };
}
