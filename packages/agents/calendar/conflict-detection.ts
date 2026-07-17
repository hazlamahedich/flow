import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarProvider } from '../providers/calendar-provider.js';
import { withTimeout } from './provider-utils.js';

/** A calendar event involved in a conflict. */
export interface ConflictEvent {
  eventId: string;
  providerEventId: string;
  title: string;
  calendarId: string;
  startAt: Date;
  endAt: Date;
}

/** A pair of conflicting events with their overlap duration. */
export interface ConflictResult {
  event1: ConflictEvent;
  event2: ConflictEvent;
  overlapSeconds: number;
}

/** Parameters for the conflict detection function. */
export interface ConflictDetectionParams {
  supabase: SupabaseClient;
  workspaceId: string;
  event: {
    id: string;
    clientCalendarId: string;
    startAt: string;
    endAt: string;
    providerEventId: string;
    title: string;
  };
  accessToken: string;
  calendarId: string;
  provider: CalendarProvider;
}

/** Row shape from calendar_events overlap query. */
interface OverlappingEventRow {
  id: string;
  provider_event_id: string;
  title: string;
  client_calendar_id: string;
  start_at: string;
  end_at: string;
}

const PROVIDER_TIMEOUT_MS = 30_000;

/**
 * Calculate the overlap in seconds between two time intervals.
 * Returns 0 if there is no overlap.
 */
function calculateOverlapSeconds(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
): number {
  const overlapStart = Math.max(start1.getTime(), start2.getTime());
  const overlapEnd = Math.min(end1.getTime(), end2.getTime());
  const overlapMs = overlapEnd - overlapStart;
  return overlapMs > 0 ? Math.round(overlapMs / 1000) : 0;
}

/**
 * Detect calendar conflicts for a given event.
 *
 * Merges results from the local DB (authoritative) and the remote provider
 * (supplementary). Provider conflicts not already present in the DB are added
 * by provider_event_id deduplication. Returns results sorted by overlap
 * duration (descending).
 *
 * Gracefully degrades to DB-only results if the provider call times out or fails.
 */
export async function detectConflictsForEvent(
  params: ConflictDetectionParams,
): Promise<ConflictResult[]> {
  const { supabase, workspaceId, event, accessToken, calendarId, provider } =
    params;

  const eventStart = new Date(event.startAt);
  const eventEnd = new Date(event.endAt);
  const now = new Date().toISOString();

  // --- Step 1: Query DB for overlapping events ---
  const { data: dbRows, error: dbError } = await supabase
    .from('calendar_events')
    .select(
      'id, provider_event_id, title, client_calendar_id, start_at, end_at',
    )
    .eq('workspace_id', workspaceId)
    .neq('id', event.id)
    .gt('end_at', event.startAt)
    .lt('start_at', event.endAt)
    .gt('end_at', now);

  if (dbError) {
    throw Object.assign(
      new Error(`Failed to query overlapping events: ${dbError.message}`),
      { code: 'CALENDAR_CONNECTION_FAILED' as const, statusCode: 500 },
    );
  }

  const overlappingRows: OverlappingEventRow[] = (dbRows ??
    []) as OverlappingEventRow[];

  // Build conflict results from DB rows
  const conflicts: ConflictResult[] = overlappingRows.map((row) => {
    const rowStart = new Date(row.start_at);
    const rowEnd = new Date(row.end_at);

    const conflictEvent: ConflictEvent = {
      eventId: row.id,
      providerEventId: row.provider_event_id,
      title: row.title,
      calendarId: row.client_calendar_id,
      startAt: rowStart,
      endAt: rowEnd,
    };

    const sourceEvent: ConflictEvent = {
      eventId: event.id,
      providerEventId: event.providerEventId,
      title: event.title,
      calendarId: event.clientCalendarId,
      startAt: eventStart,
      endAt: eventEnd,
    };

    return {
      event1: sourceEvent,
      event2: conflictEvent,
      overlapSeconds: calculateOverlapSeconds(
        eventStart,
        eventEnd,
        rowStart,
        rowEnd,
      ),
    };
  });

  // Track provider event IDs already known from DB
  const knownProviderEventIds = new Set<string>(
    overlappingRows.map((r) => r.provider_event_id),
  );
  // Also exclude the source event itself
  knownProviderEventIds.add(event.providerEventId);

  // --- Step 2: Call provider.detectConflicts() with timeout ---
  try {
    const providerResult = await withTimeout(
      provider.detectConflicts(
        accessToken,
        calendarId,
        event.startAt,
        event.endAt,
        [event.providerEventId],
      ),
      PROVIDER_TIMEOUT_MS,
    );

    // --- Step 3: Merge results - add provider conflicts not already in DB ---
    for (const pc of providerResult.conflicts) {
      if (knownProviderEventIds.has(pc.eventId)) {
        continue;
      }
      knownProviderEventIds.add(pc.eventId);

      const pcStart = new Date(pc.startTime);
      const pcEnd = new Date(pc.endTime);

      const providerConflictEvent: ConflictEvent = {
        eventId: '', // No DB row ID for provider-only conflicts
        providerEventId: pc.eventId,
        title: pc.title,
        calendarId: event.clientCalendarId,
        startAt: pcStart,
        endAt: pcEnd,
      };

      const sourceEvent: ConflictEvent = {
        eventId: event.id,
        providerEventId: event.providerEventId,
        title: event.title,
        calendarId: event.clientCalendarId,
        startAt: eventStart,
        endAt: eventEnd,
      };

      conflicts.push({
        event1: sourceEvent,
        event2: providerConflictEvent,
        overlapSeconds: calculateOverlapSeconds(
          eventStart,
          eventEnd,
          pcStart,
          pcEnd,
        ),
      });
    }
  } catch {
    // Graceful degradation: provider timeout or failure → DB-only results
  }

  // --- Step 5: Sort by overlapSeconds descending ---
  conflicts.sort((a, b) => b.overlapSeconds - a.overlapSeconds);

  return conflicts;
}
