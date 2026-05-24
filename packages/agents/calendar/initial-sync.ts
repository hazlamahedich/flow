/* eslint-disable max-lines */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarProvider, CalendarEvent } from '../providers/calendar-provider.js';
import { GoogleCalendarProvider } from '../providers/index.js';
import type { CalendarProviderName } from '@flow/types';
import type { AgentRunProducer } from '../orchestrator/types.js';
import { classifyEventSource } from './classify-source.js';

async function enqueueBypassForEvents(
  producer: AgentRunProducer,
  supabase: SupabaseClient,
  workspaceId: string,
  clientId: string,
  eventIds: string[],
): Promise<void> {
  const { enqueueBypassDetection } = await import('./enqueue-bypass-detection.js');
  for (const evtId of eventIds) {
    try {
      await enqueueBypassDetection({
        supabase,
        producer,
        workspaceId,
        eventId: evtId,
        clientId,
        eventCreatedAt: new Date().toISOString(),
      });
    } catch (enqueueErr: unknown) {
      const msg = enqueueErr instanceof Error ? enqueueErr.message : 'unknown error';
      console.error(
        `[calendar-initial-sync] Failed to enqueue bypass detection for event ${evtId}:`,
        msg,
      );
    }
  }
}

async function enqueueConflictForEvents(
  producer: AgentRunProducer,
  supabase: SupabaseClient,
  workspaceId: string,
  clientCalendarId: string,
  eventIds: string[],
  clientId?: string | null,
): Promise<void> {
  const { enqueueConflictDetection } = await import('./enqueue-conflict-detection.js');
  for (const evtId of eventIds) {
    try {
      await enqueueConflictDetection({
        supabase,
        producer,
        workspaceId,
        eventId: evtId,
        clientCalendarId,
        ...(clientId != null ? { clientId } : {}),
      });
    } catch (enqueueErr: unknown) {
      const msg = enqueueErr instanceof Error ? enqueueErr.message : 'unknown error';
      console.error(
        `[calendar-initial-sync] Failed to enqueue conflict detection for event ${evtId}:`,
        msg,
      );
    }
  }
}

async function incrementMetricsForEvents(
  supabase: SupabaseClient,
  workspaceId: string,
  clientId: string,
  eventIds: string[],
): Promise<void> {
  const { incrementTotalEvents } = await import('./bypass-metrics.js');
  for (const evtId of eventIds) {
    try {
      await incrementTotalEvents(supabase, workspaceId, clientId);
    } catch (incrErr: unknown) {
      const msg = incrErr instanceof Error ? incrErr.message : 'unknown error';
      console.error(
        `[calendar-initial-sync] Failed to increment total events for ${evtId}:`,
        msg,
      );
    }
  }
}

/** Parameters for performing the initial calendar sync. */
export interface InitialSyncParams {
  supabase: SupabaseClient;
  workspaceId: string;
  clientCalendarId: string;
  accessToken: string;
  calendarId: string;
  provider: CalendarProviderName;
  conflictProducer?: AgentRunProducer;
  clientId?: string | null;
  vaEmail?: string;
  calendars?: Array<{ emailAddress: string | null }>;
}

/** Row shape from client_calendars that we need for token decryption. */
interface ClientCalendarRow {
  id: string;
  oauth_state: Record<string, unknown>;
  sync_status: string;
  updated_at: string | null;
}

const SYNC_WINDOW_DAYS = 90;
const BATCH_SIZE = 100;
const API_TIMEOUT_MS = 30_000;

function ninetyDaysAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - SYNC_WINDOW_DAYS);
  return d.toISOString();
}

function nowISO(): string {
  return new Date().toISOString();
}

function resolveProvider(name: CalendarProviderName): CalendarProvider {
  switch (name) {
    case 'google_calendar':
      return new GoogleCalendarProvider();
    case 'outlook':
      throw new Error('Outlook calendar provider not yet implemented');
    default:
      throw new Error(`Unknown calendar provider: ${name as string}`);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`API call timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function mapEventToRow(
  event: CalendarEvent,
  workspaceId: string,
  clientCalendarId: string,
  source?: string,
) {
  return {
    workspace_id: workspaceId,
    client_calendar_id: clientCalendarId,
    client_id: null,
    provider_event_id: event.providerEventId,
    title: event.title,
    description: event.description ?? null,
    location: event.location ?? null,
    start_at: event.startTime,
    end_at: event.endTime,
    is_all_day: event.isAllDay,
    attendees: event.attendees as unknown as Record<string, unknown>[],
    event_type: 'unknown' as const,
    source: source ?? ('unknown' as const),
    is_recurring: !!event.recurrenceRule,
    recurring_rule: event.recurrenceRule ?? null,
    created_via: 'external' as const,
    raw_data: (event.providerMetadata ?? {}) as Record<string, unknown>,
  };
}

async function getCalendarWithState(
  supabase: SupabaseClient,
  calendarId: string,
): Promise<ClientCalendarRow | null> {
  const { data, error } = await supabase
    .from('client_calendars')
    .select('id, oauth_state, sync_status, updated_at')
    .eq('id', calendarId)
    .maybeSingle();
  if (error) throw error;
  return data as ClientCalendarRow | null;
}

/**
 * Perform an initial sync for a newly connected calendar.
 *
 * Pulls the last 90 days of events from the provider and upserts them into
 * `calendar_events`, then marks the calendar as connected with a sync cursor.
 */
export async function performInitialSync(params: InitialSyncParams): Promise<void> {
  const { supabase, workspaceId, clientCalendarId, accessToken, calendarId, provider: providerName } = params;

  const provider = resolveProvider(providerName);

  // Mark calendar as syncing
  const calendarRow = await getCalendarWithState(supabase, clientCalendarId);
  if (!calendarRow || calendarRow.sync_status === 'disconnected') {
    return;
  }

  await supabase
    .from('client_calendars')
    .update({ sync_status: 'syncing' })
    .eq('id', clientCalendarId);

  try {
    // Pull events from provider (last 90 days)
    const timeMin = ninetyDaysAgoISO();
    const timeMax = nowISO();

    const events: CalendarEvent[] = await withTimeout(
      provider.listEvents(accessToken, calendarId, timeMin, timeMax),
      API_TIMEOUT_MS,
    );

    // Batch upsert events in chunks of BATCH_SIZE
    const upsertedEventIds: string[] = [];

    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const chunk = events.slice(i, i + BATCH_SIZE);
      const rows = chunk.map((ev) => {
        let classifiedSource: string | undefined;
        if (params.vaEmail && params.calendars) {
          const src = classifyEventSource(
            {
              organizerEmail: (ev.providerMetadata?.organizerEmail as string | undefined) ?? null,
              title: ev.title,
              isRecurring: !!ev.recurrenceRule,
            },
            params.calendars,
            params.vaEmail,
          );
          classifiedSource = src;
        }
        return mapEventToRow(ev, workspaceId, clientCalendarId, classifiedSource);
      });

      const { data: upsertedData, error: upsertError } = await supabase
        .from('calendar_events')
        .upsert(rows, {
          onConflict: 'client_calendar_id,provider_event_id',
          ignoreDuplicates: true,
        })
        .select('id');

      if (upsertError) {
        console.error(
          `[calendar-initial-sync] Batch upsert failed for calendar ${clientCalendarId}, chunk starting at index ${i}:`,
          upsertError.message,
        );
        // Continue with remaining chunks rather than aborting entirely
      }

      if (upsertedData) {
        for (const row of upsertedData) {
          upsertedEventIds.push((row as { id: string }).id);
        }
      }
    }

    if (params.conflictProducer && upsertedEventIds.length > 0) {
      await enqueueConflictForEvents(
        params.conflictProducer,
        supabase,
        workspaceId,
        clientCalendarId,
        upsertedEventIds,
        params.clientId,
      );
    }

    if (params.clientId && upsertedEventIds.length > 0) {
      await incrementMetricsForEvents(supabase, workspaceId, params.clientId, upsertedEventIds);

      if (params.conflictProducer) {
        await enqueueBypassForEvents(
          params.conflictProducer,
          supabase,
          workspaceId,
          params.clientId,
          upsertedEventIds,
        );
      }
    }

    const lastEvent = events.length > 0 ? events[events.length - 1] : null;
    let syncCursor: string | null = null;
    if (lastEvent?.providerMetadata) {
      syncCursor =
        (lastEvent.providerMetadata.nextSyncToken as string | undefined) ??
        (lastEvent.providerMetadata.etag as string | undefined) ??
        null;
    }

    // Mark calendar as connected with cursor and timestamp
    await supabase
      .from('client_calendars')
      .update({
        sync_status: 'connected',
        last_sync_at: new Date().toISOString(),
        sync_cursor: syncCursor,
        error_message: null,
      })
      .eq('id', clientCalendarId);

    console.log(
      `[calendar-initial-sync] Synced ${events.length} events for calendar ${clientCalendarId}`,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Initial calendar sync failed';
    console.error(`[calendar-initial-sync] Failed for calendar ${clientCalendarId}:`, message);

    await supabase
      .from('client_calendars')
      .update({
        sync_status: 'error',
        error_message: message,
      })
      .eq('id', clientCalendarId);

    throw err;
  }
}
