import type { SupabaseClient } from '@supabase/supabase-js';
import type { Invoice } from '../../schema';

interface LineItemInput {
  sourceType: string;
  timeEntryId: string | null;
  retainerId: string | null;
  description: string;
  quantity: string;
  unitPriceCents: number;
  amountCents: number;
  sortOrder: number;
}

interface CreateInvoiceParams {
  workspaceId: string;
  clientId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalCents: number;
  notes: string | null;
  createdBy: string;
  lineItems: LineItemInput[];
}

export async function createInvoice(
  client: SupabaseClient,
  params: CreateInvoiceParams,
): Promise<Invoice> {
  const { data: invoice, error: invoiceError } = await client
    .from('invoices')
    .insert({
      workspace_id: params.workspaceId,
      client_id: params.clientId,
      invoice_number: params.invoiceNumber,
      status: 'draft',
      issue_date: params.issueDate,
      due_date: params.dueDate,
      total_cents: params.totalCents,
      notes: params.notes,
      created_by: params.createdBy,
    })
    .select()
    .single();

  if (invoiceError) throw invoiceError;
  if (!invoice) throw new Error('Failed to create invoice');

  if (params.lineItems.length > 0) {
    const { error: itemsError } = await client
      .from('invoice_line_items')
      .insert(
        params.lineItems.map((item) => ({
          invoice_id: invoice.id,
          workspace_id: params.workspaceId,
          source_type: item.sourceType,
          time_entry_id: item.timeEntryId,
          retainer_id: item.retainerId,
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unitPriceCents,
          amount_cents: item.amountCents,
          sort_order: item.sortOrder,
        })),
      );

    if (itemsError) throw itemsError;
  }

  return {
    id: invoice.id,
    workspaceId: invoice.workspace_id,
    clientId: invoice.client_id,
    invoiceNumber: invoice.invoice_number,
    status: invoice.status,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    totalCents: invoice.total_cents,
    currency: invoice.currency,
    notes: invoice.notes,
    metadata: invoice.metadata,
    createdBy: invoice.created_by,
    voidedAt: invoice.voided_at,
    voidReason: invoice.void_reason,
    createdAt: invoice.created_at,
    updatedAt: invoice.updated_at,
    paymentUrl: invoice.payment_url ?? null,
    sentAt: invoice.sent_at ?? null,
    viewedAt: invoice.viewed_at ?? null,
    deliveryToken: invoice.delivery_token ?? null,
    amountPaidCents: invoice.amount_paid_cents ?? 0,
    creditBalanceCents: invoice.credit_balance_cents ?? 0,
    version: invoice.version ?? 1,
  };
}
