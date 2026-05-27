import { getServerSupabase } from '@/lib/supabase-server';
import { createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';

type SupabaseClient = Awaited<ReturnType<typeof getServerSupabase>>;

export type TimeEntryMap = Map<string, { durationMinutes: number }>;

/**
 * Resolve time entry durations for billing computation.
 */
export async function resolveTimeEntryDurations(
  supabase: SupabaseClient,
  workspaceId: string,
  clientId: string,
  timeEntryIds: string[],
): Promise<ActionResult<TimeEntryMap>> {
  const { data: timeRows, error: teError } = await supabase
    .from('time_entries')
    .select('id, duration_minutes')
    .in('id', timeEntryIds)
    .eq('workspace_id', workspaceId)
    .eq('client_id', clientId);

  if (teError || !timeRows) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to fetch time entries.', 'system'),
    };
  }

  const map = new Map<string, { durationMinutes: number }>();
  for (const row of timeRows as Array<{ id: string; duration_minutes: number }>) {
    map.set(row.id, { durationMinutes: row.duration_minutes });
  }
  return { success: true, data: map };
}
