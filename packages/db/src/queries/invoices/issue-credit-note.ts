import type { SupabaseClient } from '@supabase/supabase-js';

export interface IssueCreditNoteResult {
  creditNoteId: string;
  newCreditBalanceCents: number;
  lineItemSortOrder: number;
}

export async function issueCreditNoteViaRpc(
  client: SupabaseClient,
  invoiceId: string,
  workspaceId: string,
  amountCents: number,
  reason: string,
  createdBy: string,
): Promise<IssueCreditNoteResult | null> {
  const { data, error } = await client.rpc('issue_credit_note', {
    p_invoice_id: invoiceId,
    p_workspace_id: workspaceId,
    p_amount_cents: amountCents,
    p_reason: reason,
    p_created_by: createdBy,
  });

  if (error) throw error;
  if (!data) return null;

  const result = data as Record<string, unknown>;

  if (result.error) {
    return null;
  }

  return {
    creditNoteId: result.credit_note_id as string,
    newCreditBalanceCents: Number(result.new_credit_balance_cents),
    lineItemSortOrder: Number(result.line_item_sort_order),
  };
}
