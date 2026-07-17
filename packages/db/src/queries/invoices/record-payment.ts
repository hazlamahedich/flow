import type { SupabaseClient } from '@supabase/supabase-js';

export interface InvoicePaymentResult {
  paymentId: string;
  newStatus: string;
  amountPaidCents: number;
  creditBalanceCents: number;
}

export async function recordPaymentViaRpc(
  client: SupabaseClient,
  args: {
    invoiceId: string;
    workspaceId: string;
    amountCents: number;
    paymentMethod: string;
    paymentDate: string;
    notes?: string | null;
    stripePaymentIntentId?: string | null;
    createdBy?: string | null;
  },
): Promise<InvoicePaymentResult | null> {
  const { data, error } = await client.rpc('record_payment_with_concurrency', {
    p_invoice_id: args.invoiceId,
    p_workspace_id: args.workspaceId,
    p_amount_cents: args.amountCents,
    p_payment_method: args.paymentMethod,
    p_payment_date: args.paymentDate,
    p_notes: args.notes ?? null,
    p_stripe_payment_intent_id: args.stripePaymentIntentId ?? null,
    p_created_by: args.createdBy ?? null,
  });

  if (error) throw error;
  if (!data) return null;

  const result = data as Record<string, unknown>;

  if (result.error) {
    const errCode = result.error as string;
    const e = new Error(`Payment recording failed: ${errCode}`);
    (e as Error & { code: string }).code = errCode;
    throw e;
  }

  return {
    paymentId: result.payment_id as string,
    newStatus: result.new_status as string,
    amountPaidCents: Number(result.amount_paid_cents),
    creditBalanceCents: Number(result.credit_balance_cents),
  };
}
