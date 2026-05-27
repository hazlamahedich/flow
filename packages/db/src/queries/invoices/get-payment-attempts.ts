import type { SupabaseClient } from '@supabase/supabase-js';
import type { InvoicePaymentAttempt } from '../../schema/stripe-webhooks';

export interface PaymentAttempt {
  id: string;
  invoiceId: string;
  workspaceId: string;
  stripeEventId: string | null;
  attemptType: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  amountCents: number;
  createdAt: string;
}

export async function getPaymentAttemptsByInvoice(
  client: SupabaseClient,
  invoiceId: string,
  workspaceId: string,
): Promise<PaymentAttempt[]> {
  const { data, error } = await client
    .from('invoice_payment_attempts')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    invoiceId: row.invoice_id as string,
    workspaceId: row.workspace_id as string,
    stripeEventId: (row.stripe_event_id as string | null) ?? null,
    attemptType: row.attempt_type as string,
    status: row.status as string,
    errorCode: (row.error_code as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    amountCents: Number(row.amount_cents ?? 0),
    createdAt: String(row.created_at),
  }));
}
