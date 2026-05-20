import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarProviderName } from '@flow/types';
import type { InitialSyncParams } from './initial-sync.js';
import { performInitialSync } from './initial-sync.js';

/** Parameters for enqueuing an initial calendar sync. */
export interface EnqueueInitialSyncParams {
  supabase: SupabaseClient;
  workspaceId: string;
  clientCalendarId: string;
  accessToken: string;
  calendarId: string;
  provider: CalendarProviderName;
}

/**
 * Enqueue an initial_sync agent_run and then fire-and-forget the actual sync.
 *
 * Mirrors the Gmail callback's enqueueInitialSync pattern:
 *  1. Insert an agent_runs record with status 'pending'.
 *  2. Kick off the sync in the background (non-blocking).
 */
export async function enqueueInitialSync(params: EnqueueInitialSyncParams): Promise<void> {
  const { supabase, workspaceId, clientCalendarId } = params;

  const runId = crypto.randomUUID();

  await supabase.from('agent_runs').insert({
    id: runId,
    workspace_id: workspaceId,
    agent_id: 'calendar',
    action_type: 'initial_sync',
    status: 'pending',
    input: {
      clientCalendarId,
      workspaceId,
    },
    correlation_id: crypto.randomUUID(),
  });

  // Fire-and-forget: the sync runs in the background
  const syncParams: InitialSyncParams = {
    supabase: params.supabase,
    workspaceId: params.workspaceId,
    clientCalendarId: params.clientCalendarId,
    accessToken: params.accessToken,
    calendarId: params.calendarId,
    provider: params.provider,
  };

  // Update agent_runs status as sync progresses
  await supabase
    .from('agent_runs')
    .update({ status: 'running' })
    .eq('id', runId);

  performInitialSync(syncParams)
    .then(async () => {
      await supabase
        .from('agent_runs')
        .update({ status: 'completed' })
        .eq('id', runId);
    })
    .catch(async (err) => {
      console.error(
        '[calendar-initial-sync] Fire-and-forget sync failed for',
        clientCalendarId,
        err,
      );
      await supabase
        .from('agent_runs')
        .update({ status: 'failed' })
        .eq('id', runId);
    });
}
