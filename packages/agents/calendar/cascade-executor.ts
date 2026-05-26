import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { CalendarProvider } from '../providers/calendar-provider.js';
import { withTimeout } from './provider-utils.js';
import type { CascadeOption, CascadeExecutionResult } from './resolve-cascade-action.js';
import { CalendarTokenManager } from '../providers/google-calendar/token-manager.js';
import type { OAuthStateEncrypted } from '@flow/types';
import { ClientCalendarRowSchema, CalendarEventRowSchema } from './schemas.js';

interface EventSnapshot {
  title: string;
  start: string;
  end: string;
  providerEventId: string;
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

  const { data: rawCalData } = await supabase
    .from('client_calendars')
    .select('id, calendar_id, provider, oauth_state')
    .eq('workspace_id', workspaceId)
    .eq('sync_status', 'connected')
    .limit(1);

  const calRaw = (rawCalData ?? [])[0];
  if (!calRaw) {
    throw Object.assign(
      new Error('No connected calendar found for cascade execution'),
      { code: 'CALENDAR_NOT_FOUND' as const, statusCode: 404 },
    );
  }

  const calParsed = ClientCalendarRowSchema.safeParse(calRaw);
  if (!calParsed.success) {
    throw Object.assign(
      new Error(`Invalid calendar row: ${calParsed.error.message}`),
      { code: 'CALENDAR_PARSE_FAILED' as const, statusCode: 500 },
    );
  }
  const calendar = calParsed.data;

  const provider = getProvider(calendar.provider);
  const tokenManager = new CalendarTokenManager(provider);
  const { tokens } = await tokenManager.getValidTokens(
    calendar.id,
    calendar.oauth_state as unknown as OAuthStateEncrypted,
  );

  if (!tokens.accessToken) {
    throw Object.assign(
      new Error('Empty access token — cannot execute cascade'),
      { code: 'CALENDAR_AUTH_FAILED' as const, statusCode: 401 },
    );
  }
  const accessToken = tokens.accessToken;

  const { data: rawEventData } = await supabase
    .from('calendar_events')
    .select('id, title, start_at, end_at, provider_event_id, client_calendar_id')
    .in('id', eventsToUpdate.map((e) => e.eventId))
    .eq('workspace_id', workspaceId);

  const snapshots = new Map<string, EventSnapshot>();
  for (const rawEv of rawEventData ?? []) {
    const ev = CalendarEventRowSchema.pick({
      id: true, title: true, start_at: true, end_at: true,
    }).extend({ provider_event_id: z.string() }).safeParse(rawEv);
    if (!ev.success) continue;
    snapshots.set(ev.data.id, {
      title: ev.data.title,
      start: ev.data.start_at,
      end: ev.data.end_at,
      providerEventId: ev.data.provider_event_id,
    });
  }

  const executed: Array<{ eventId: string; action: string }> = [];
  const rolledBack: Array<{ eventId: string; action: string }> = [];
  const rollbackFailures: Array<{ eventId: string; error: string }> = [];

  try {
    for (const affected of eventsToUpdate) {
      const snapshot = snapshots.get(affected.eventId);
      if (!snapshot) continue;

      if (affected.action === 'cancel') {
        await withTimeout(
          provider.deleteEvent(accessToken, calendar.calendar_id, snapshot.providerEventId),
          PROVIDER_TIMEOUT_MS,
        );
      } else {
        await withTimeout(
          provider.updateEvent(accessToken, {
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
        if (item.action === 'cancel') {
          rollbackFailures.push({ eventId: item.eventId, error: 'cannot recreate deleted provider event' });
        } else {
          await withTimeout(
            provider.updateEvent(accessToken, {
              providerEventId: snapshot.providerEventId,
              calendarId: calendar.calendar_id,
              title: snapshot.title,
              startTime: snapshot.start,
              endTime: snapshot.end,
            }),
            PROVIDER_TIMEOUT_MS,
          );
          rolledBack.push({ eventId: item.eventId, action: `rollback:${item.action}` });
        }
      } catch (rollbackErr: unknown) {
        const errMsg = rollbackErr instanceof Error ? rollbackErr.message : 'unknown';
        rollbackFailures.push({ eventId: item.eventId, error: errMsg });
      }
    }

    await recordSagaResult(supabase, workspaceId, executed, rolledBack, rollbackFailures);

    const message = err instanceof Error ? err.message : 'Cascade execution failed';
    throw Object.assign(
      new Error(`Cascade execution failed, rolled back ${rolledBack.length}/${executed.length}${rollbackFailures.length > 0 ? `, ${rollbackFailures.length} rollback failures` : ''}: ${message}`),
      { code: 'CASCADE_PARTIAL_FAILURE' as const, statusCode: 500 },
    );
  }

  await recordSagaResult(supabase, workspaceId, executed, rolledBack, rollbackFailures);

  await emitCascadeSignal(
    supabase,
    workspaceId,
    eventsToUpdate[0]!.eventId,
    eventsToUpdate,
    executed.length === eventsToUpdate.length ? 'completed' : 'partial_failure',
  );

  return { success: true, executed, rolledBack };
}

async function recordSagaResult(
  supabase: SupabaseClient,
  workspaceId: string,
  executed: Array<{ eventId: string; action: string }>,
  rolledBack: Array<{ eventId: string; action: string }>,
  rollbackFailures: Array<{ eventId: string; error: string }>,
): Promise<void> {
  const { error } = await supabase
    .from('agent_runs')
    .insert({
      agent_id: 'calendar',
      action_type: 'cascadeExecution',
      status: rollbackFailures.length > 0 ? 'partial_failure' : 'completed',
      workspace_id: workspaceId,
      metadata: {
        executed: executed.map((e) => ({ event_id: e.eventId, action: e.action })),
        rolled_back: rolledBack.map((e) => ({ event_id: e.eventId, action: e.action })),
        rollback_failures: rollbackFailures.map((e) => ({ event_id: e.eventId, error: e.error })),
      } as unknown as Record<string, unknown>,
    });

  if (error) {
    console.error('[cascade-executor] Failed to record saga result:', error.message);
  }
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
