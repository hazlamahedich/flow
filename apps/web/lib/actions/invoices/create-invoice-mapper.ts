import { createFlowError } from '@flow/db';
import type { Invoice } from '@flow/types';
import type { SupabaseClient } from '@flow/db';

export async function mapCreatedInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  clientId: string,
  invoiceNumber: string,
  issueDate: string,
  dueDate: string,
  totalCents: number,
  notes: string | undefined,
  workspaceId: string,
): Promise<{ success: true; data: Invoice } | { success: false; error: ReturnType<typeof createFlowError> }> {
  const { data: created } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (!created) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Invoice created but not found.', 'system'),
    };
  }

  const inv = created as Record<string, unknown>;

  return {
    success: true,
    data: {
      id: (inv.id as string) ?? invoiceId,
      workspaceId: (inv.workspace_id as string) ?? workspaceId,
      clientId,
      invoiceNumber,
      status: 'draft',
      issueDate,
      dueDate,
      totalCents,
      currency: (inv.currency as string) ?? 'usd',
      notes: notes ?? null,
      voidedAt: null,
      voidReason: null,
      createdAt: (inv.created_at as string) ?? new Date().toISOString(),
      updatedAt: (inv.updated_at as string) ?? new Date().toISOString(),
      amountPaidCents: 0,
      creditBalanceCents: 0,
      version: 1,
      paymentUrl: null,
      sentAt: null,
      viewedAt: null,
      deliveryToken: null,
    } as Invoice,
  };
}
