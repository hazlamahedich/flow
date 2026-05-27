import type { SupabaseClient } from '@supabase/supabase-js';

export interface VoidInvoiceResult {
  success: boolean;
  status: string;
  timeEntriesCleared: number;
}

export async function voidInvoiceViaRpc(
  client: SupabaseClient,
  invoiceId: string,
  workspaceId: string,
  reason: string,
): Promise<VoidInvoiceResult | null> {
  const { data, error } = await client
    .rpc('void_invoice_and_clear_time_entries', {
      p_invoice_id: invoiceId,
      p_workspace_id: workspaceId,
      p_void_reason: reason,
    });

  if (error) throw error;
  if (!data) return null;

  const result = data as Record<string, unknown>;

  if (result.error) {
    return null;
  }

  return {
    success: Boolean(result.success),
    status: result.status as string,
    timeEntriesCleared: Number(result.time_entries_cleared ?? 0),
  };
}
