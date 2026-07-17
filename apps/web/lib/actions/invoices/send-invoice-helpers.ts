import { getServerSupabase } from '@/lib/supabase-server';
import { createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';

type SupabaseClient = Awaited<ReturnType<typeof getServerSupabase>>;

const nowIso = (): string => new Date().toISOString();

/**
 * Mark referenced time entries as invoiced after successful send.
 */
export async function markTimeEntriesInvoiced(
  supabase: SupabaseClient,
  workspaceId: string,
  invoiceId: string,
): Promise<ActionResult<void>> {
  const { data: lineItemTimeEntries } = await supabase
    .from('invoice_line_items')
    .select('time_entry_id')
    .eq('invoice_id', invoiceId)
    .not('time_entry_id', 'is', null);

  const invoicedTimeEntryIds = (
    (lineItemTimeEntries ?? []) as Array<{ time_entry_id: string | null }>
  )
    .map((te) => te.time_entry_id)
    .filter((id): id is string => id !== null);

  if (invoicedTimeEntryIds.length === 0) {
    return { success: true, data: undefined };
  }

  const { error: teMarkError } = await supabase
    .from('time_entries')
    .update({ invoiced_at: nowIso() })
    .in('id', invoicedTimeEntryIds)
    .eq('workspace_id', workspaceId);

  if (teMarkError) {
    console.error(
      'Failed to mark time entries as invoiced:',
      teMarkError.message,
      { invoiceId, timeEntryIds: invoicedTimeEntryIds },
    );
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to mark time entries as invoiced.',
        'system',
      ),
    };
  }

  return { success: true, data: undefined };
}
