import { getServerSupabase } from '@/lib/supabase-server';
import { createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';

type SupabaseClient = Awaited<ReturnType<typeof getServerSupabase>>;

/**
 * Check if any time entry IDs are already invoiced on another non-voided invoice.
 */
export async function checkDuplicateTimeEntries(
  supabase: SupabaseClient,
  workspaceId: string,
  clientId: string,
  timeEntryIds: string[],
): Promise<ActionResult<never> | null> {
  if (timeEntryIds.length === 0) return null;

  const { data: alreadyInvoiced, error: dupError } = await supabase
    .from('invoice_line_items')
    .select('time_entry_id')
    .in('time_entry_id', timeEntryIds)
    .eq('workspace_id', workspaceId)
    .neq('source_type', 'credit_note');

  if (dupError) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to check duplicate time entries.',
        'system',
      ),
    };
  }

  const invoicedSet = new Set(
    (alreadyInvoiced ?? []).map(
      (r: Record<string, unknown>) => r.time_entry_id as string,
    ),
  );

  const dupIds = timeEntryIds.filter((id) => invoicedSet.has(id));
  if (dupIds.length > 0) {
    return {
      success: false,
      error: createFlowError(
        409,
        'VALIDATION_ERROR',
        `Time entries already on another invoice: ${dupIds.join(', ')}`,
        'validation',
      ),
    };
  }

  return null;
}
