import type { SupabaseClient } from '@supabase/supabase-js';

export interface InvoicePaymentRecord {
  id: string;
  invoiceId: string;
  workspaceId: string;
  amountCents: number;
  paymentMethod: string;
  paymentDate: string;
  notes: string | null;
  stripePaymentIntentId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentHistoryRecord {
  id: string;
  amountCents: number;
  paymentMethod: string;
  paymentDate: string;
  notes: string | null;
  createdAt: string;
  recordedByName: string | null;
}

export async function getInvoicePayments(
  client: SupabaseClient,
  invoiceId: string,
  workspaceId: string,
): Promise<PaymentHistoryRecord[]> {
  const { data: rows, error } = await client
    .from('invoice_payments')
    .select('id, amount_cents, payment_method, payment_date, notes, created_at, users(name)')
    .eq('invoice_id', invoiceId)
    .eq('workspace_id', workspaceId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (rows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    amountCents: Number(r.amount_cents),
    paymentMethod: r.payment_method as string,
    paymentDate: String(r.payment_date),
    notes: r.notes as string | null,
    createdAt: String(r.created_at),
    recordedByName: ((r.users as Record<string, unknown> | null)?.name ?? null) as string | null,
  }));
}
