import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarProvider } from '../providers/calendar-provider.js';
import { withTimeout } from './provider-utils.js';
import type { CascadeOption, CascadeExecutionResult } from './resolve-cascade-action.js';

interface CalendarRow {
  id: string;
  calendar_id: string;
  provider: string;
  oauth_state: Record<string, unknown>;
}

const PROVIDER_TIMEOUT_MS = 30_000;

export async function executeCascadeOption(
  runId: string,
  workspaceId: string,
  option: CascadeOption,
  supabase: SupabaseClient,
  getProvider: (name: string) => CalendarProvider,
): Promise<CascadeExecutionResult> {
  void runId;

  const eventsToUpdate = option.affectedEvents.filter((e) => e.action !== 'keep');
  if (eventsToUpdate.length === 0) {
    return { success: true, executed: [], rolledBack: [] };
  }

  const { data: calData } = await supabase
    .from('client_calendars')
    .select('id, calendar_id, provider, oauth_state')
    .eq('workspace_id', workspaceId)
    .eq('sync_status', 'connected')
    .limit(1);

  const cal = (calData ?? []) as CalendarRow[];
  if (cal.length === 0) {
    throw Object.assign(
      new Error('No connected calendar found for cascade execution'),
      { code: 'CALENDAR_NOT_FOUND' as const, statusCode: 404 },
    );
  }

  const calendar = cal[0]!;
  const { data: eventData } = await supabase
    .from('calendar_events')
    .select('id, title, start_at, end_at, provider_event_id, client_calendar_id')
    .in('id', eventsToUpdate.map((e) => e.eventId))
    .eq('workspace_id', workspaceId);

  const dbEvents = (eventData ?? []) as Array<{
    id: string;
    title: string;
    start_at: string;
    end_at: string;
    provider_event_id: string;
    client_calendar_id: string;
  }>;

  const snapshots = new Map<string, { title: string; start: string; end: string; providerEventId: string }>();
  for (const ev of dbEvents) {
    snapshots.set(ev.id, {
      title: ev.title,
      start: ev.start_at,
      end: ev.end_at,
      providerEventId: ev.provider_event_id,
    });
  }

  const executed: Array<{ eventId: string; action: string }> = [];
  const rolledBack: Array<{ eventId: string; action: string }> = [];
  const rollbackFailures: Array<{ eventId: string; error: string }> = [];

  try {
    for (const affected of eventsToUpdate) {
      const snapshot = snapshots.get(affected.eventId);
      if (!snapshot) continue;

      const provider = getProvider(calendar.provider);
      if (affected.action === 'cancel') {
        await withTimeout(
          provider.deleteEvent('', calendar.calendar_id, snapshot.providerEventId),
          PROVIDER_TIMEOUT_MS,
        );
      } else {
        await withTimeout(
          provider.updateEvent('', {
            providerEventId: snapshot.providerEventId,
            calendarId: calendar.calendar_id,
            title: snapshot.title,
            startTime: snapshot.start,
            endTime: snapshot.end,
          }),
          PROVIDER_TIMEOUT_MS,
        );
      }

      executed.push({ eventId: affected.eventId, action: affected.action });
    }
  } catch (err: unknown) {
    for (let i = executed.length - 1; i >= 0; i--) {
      const item = executed[i]!;
      const snapshot = snapshots.get(item.eventId);
      if (!snapshot) continue;

      try {
        const provider = getProvider(calendar.provider);
        if (item.action === 'cancel') {
          /* cancel rollback: event was deleted, cannot restore via updateEvent.
             log as rollback failure — provider event is gone */
          rollbackFailures.push({ eventId: item.eventId, error: 'cannot recreate deleted provider event' });
        } else {
          await withTimeout(
            provider.updateEvent('', {
              providerEventId: snapshot.providerEventId,
              calendarId: calendar.calendar_id,
              title: snapshot.title,
              startTime: snapshot.start,
              endTime: snapshot.end,
            }),
            PROVIDER_TIMEOUT_MS,
          );
        }
        rolledBack.push({ eventId: item.eventId, action: `rollback:${item.action}` });
      } catch (rollbackErr: unknown) {
        const errMsg = rollbackErr instanceof Error ? rollbackErr.message : 'unknown';
        rollbackFailures.push({ eventId: item.eventId, error: errMsg });
        /* continue attempting remaining rollbacks instead of breaking */
      }
    }

    const message = err instanceof Error ? err.message : 'Cascade execution failed';
    throw Object.assign(
      new Error(`Cascade execution failed, rolled back ${rolledBack.length}/${executed.length}${rollbackFailures.length > 0 ? `, ${rollbackFailures.length} rollback failures` : ''}: ${message}`),
      { code: 'CASCADE_PARTIAL_FAILURE' as const, statusCode: 500 },
    );
  }

  await emitCascadeSignal(
    supabase,
    workspaceId,
    eventsToUpdate[0]!.eventId,
    eventsToUpdate,
    executed.length === eventsToUpdate.length ? 'completed' : 'partial_failure',
  );

  return { success: true, executed, rolledBack };
}

async function emitCascadeSignal(
  supabase: SupabaseClient,
  workspaceId: string,
  originEventId: string,
  affectedEvents: Array<{ eventId: string; action: string }>,
  status: string,
): Promise<void> {
  const dedupKey = `cal.cascade:${originEventId}`;

  const { error: signalError } = await supabase
    .from('agent_signals')
    .insert({
      correlation_id: crypto.randomUUID(),
      causation_id: crypto.randomUUID(),
      agent_id: 'calendar',
      signal_type: 'calendar.cascade.triggered',
      payload: {
        origin_event_id: originEventId,
        affected_count: affectedEvents.length,
        events_affected: affectedEvents.map((e) => ({ event_id: e.eventId, action: e.action })),
        status,
      },
      target_agent: 'inbox',
      workspace_id: workspaceId,
      dedup_key: `${dedupKey}:${status}`,
    });

  if (signalError) {
    throw Object.assign(
      new Error(`Failed to emit cascade signal: ${signalError.message}`),
      { code: 'CASCADE_SIGNAL_FAILED' as const, statusCode: 500 },
    );
  }
}
