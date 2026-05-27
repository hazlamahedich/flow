'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';
import type { InvoiceListItem } from '@flow/db';

export async function getInvoicesAction(
  page: number = 1,
  filter?: string,
): Promise<ActionResult<{ invoices: InvoiceListItem[]; total: number }>> {
  const supabase = await getServerSupabase();

  let ctx;
  try {
    ctx = await requireTenantContext(supabase);
  } catch {
    return {
      success: false,
      error: createFlowError(401, 'AUTH_REQUIRED', 'Authentication required', 'auth'),
    };
  }

  const pageSize = 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let countQuery = supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId);

  let listQuery = supabase
    .from('invoices')
    .select('id, invoice_number, status, issue_date, due_date, total_cents, amount_paid_cents, credit_balance_cents, currency, client_id, created_at, clients(name)')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filter === 'active') {
    countQuery = countQuery.neq('status', 'voided');
    listQuery = listQuery.neq('status', 'voided');
  } else if (filter === 'voided') {
    countQuery = countQuery.eq('status', 'voided');
    listQuery = listQuery.eq('status', 'voided');
  } else if (filter === 'with_credit') {
    countQuery = countQuery.gt('credit_balance_cents', 0);
    listQuery = listQuery.gt('credit_balance_cents', 0);
  }

  const [countResult, queryResult] = await Promise.all([
    countQuery,
    listQuery,
  ]);

  if (queryResult.error) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to fetch invoices.', 'system'),
    };
  }

  return {
    success: true,
    data: {
      invoices: (queryResult.data ?? []).map((r: Record<string, unknown>) => {
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
      total: countResult.count ?? 0,
    },
  };
}
