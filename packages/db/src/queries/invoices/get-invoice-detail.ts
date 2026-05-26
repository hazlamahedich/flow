import type { SupabaseClient } from '@supabase/supabase-js';

export interface InvoiceDetail {
  id: string;
  workspaceId: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalCents: number;
  currency: string;
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  paymentUrl: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  deliveryToken: string | null;
  lineItems: Array<{
    id: string;
    sourceType: string;
    timeEntryId: string | null;
    retainerId: string | null;
    description: string;
    quantity: string;
    unitPriceCents: number;
    amountCents: number;
    sortOrder: number;
  }>;
  deliveries: Array<{
    id: string;
    status: string;
    sentAt: string | null;
    retryCount: number;
    lastError: string | null;
    messageId: string | null;
    createdAt: string;
  }>;
}

export async function getInvoiceDetail(
  client: SupabaseClient,
  invoiceId: string,
  workspaceId: string,
): Promise<InvoiceDetail | null> {
  const { data: invoice, error } = await client
    .from('invoices')
    .select('*, clients(name, email)')
    .eq('id', invoiceId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) throw error;
  if (!invoice) return null;

  const [{ data: items }, { data: deliveries }] = await Promise.all([
    client
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order', { ascending: true }),
    client
      .from('invoice_deliveries')
      .select('id, status, sent_at, retry_count, last_error, message_id, created_at')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const clientData = invoice.clients as Record<string, unknown> | null;

  return {
    id: invoice.id,
    workspaceId: invoice.workspace_id,
    clientId: invoice.client_id,
    clientName: (clientData?.name ?? '') as string,
    clientEmail: (clientData?.email ?? null) as string | null,
    invoiceNumber: invoice.invoice_number,
    status: invoice.status,
    issueDate: String(invoice.issue_date),
    dueDate: String(invoice.due_date),
    totalCents: Number(invoice.total_cents),
    currency: invoice.currency,
    notes: invoice.notes,
    voidedAt: invoice.voided_at,
    voidReason: invoice.void_reason,
    createdBy: invoice.created_by,
    createdAt: String(invoice.created_at),
    updatedAt: String(invoice.updated_at),
    paymentUrl: invoice.payment_url ?? null,
    sentAt: invoice.sent_at ?? null,
    viewedAt: invoice.viewed_at ?? null,
    deliveryToken: invoice.delivery_token ?? null,
    lineItems: (items ?? []).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      sourceType: item.source_type as string,
      timeEntryId: item.time_entry_id as string | null,
      retainerId: item.retainer_id as string | null,
      description: item.description as string,
      quantity: String(item.quantity),
      unitPriceCents: Number(item.unit_price_cents),
      amountCents: Number(item.amount_cents),
      sortOrder: item.sort_order as number,
    })),
    deliveries: deliveries
      ? [
          {
            id: deliveries.id as string,
            status: deliveries.status as string,
            sentAt: (deliveries.sent_at as string) ?? null,
            retryCount: Number(deliveries.retry_count ?? 0),
            lastError: (deliveries.last_error as string) ?? null,
            messageId: (deliveries.message_id as string) ?? null,
            createdAt: String(deliveries.created_at),
          },
        ]
      : [],
  };
}