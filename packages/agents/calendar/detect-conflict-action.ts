import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarProvider } from '../providers/calendar-provider.js';
import type { CalendarProviderName } from '@flow/types';
import type { OAuthStateEncrypted } from '@flow/types';
import { detectConflictsForEvent } from './conflict-detection.js';
import { writeConflictSignals } from './conflict-signals.js';
import { CalendarTokenManager } from '../providers/google-calendar/token-manager.js';
import { getCalendarProvider } from '../providers/registry.js';

/** Input for the conflict detection agent action. */
export interface ConflictDetectionInput {
  workspaceId: string;
  eventId: string;
  clientCalendarId: string;
}

/** Output from the conflict detection agent action. */
export interface ConflictDetectionOutput {
  conflictsFound: number;
  conflictEventIds: string[];
}

/** Dependencies injected for testability. */
export interface ConflictDetectionDeps {
  supabase: SupabaseClient;
}

/** Calendar row shape needed for token decryption. */
interface CalendarRow {
  id: string;
  client_id: string | null;
  calendar_id: string;
  provider: CalendarProviderName;
  oauth_state: OAuthStateEncrypted;
  sync_status: string;
}

/** Event row shape from calendar_events. */
interface EventRow {
  id: string;
  client_calendar_id: string;
  provider_event_id: string;
  title: string;
  start_at: string;
  end_at: string;
}

/**
 * Execute conflict detection for a calendar event.
 *
 * Flow:
 *  1. Fetch the triggering event from DB
 *  2. Get valid tokens via CalendarTokenManager
 *  3. Run detectConflictsForEvent()
 *  4. If conflicts found, writeConflictSignals()
 *  5. Return summary
 *
 * Trust level: 0 (auto-approved, no human gate)
 * Action type: 'detectConflict'
 */
export async function executeConflictDetection(
  runId: string,
  input: ConflictDetectionInput,
  deps: ConflictDetectionDeps,
): Promise<ConflictDetectionOutput> {
  const { supabase } = deps;
  const { workspaceId, eventId, clientCalendarId } = input;
  void runId; // used by the caller for agent_runs status tracking

  // Step 1: Fetch the triggering event
  const { data: eventRow, error: eventError } = await supabase
    .from('calendar_events')
    .select('id, client_calendar_id, provider_event_id, title, start_at, end_at')
    .eq('id', eventId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (eventError || !eventRow) {
    throw Object.assign(
      new Error(`Event not found: ${eventId}`),
      { code: 'EVENT_NOT_FOUND' as const, statusCode: 404 },
    );
  }

  const event = eventRow as EventRow;

  // Step 2: Get the calendar and valid tokens
  // H1 fix: scope by workspace_id to prevent cross-workspace data leak via service client
  const { data: calRow, error: calError } = await supabase
    .from('client_calendars')
    .select('id, client_id, calendar_id, provider, oauth_state, sync_status')
    .eq('id', clientCalendarId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (calError || !calRow) {
    throw Object.assign(
      new Error(`Calendar not found: ${clientCalendarId}`),
      { code: 'CALENDAR_NOT_FOUND' as const, statusCode: 404 },
    );
  }

  const cal = calRow as CalendarRow;

  const provider: CalendarProvider = getCalendarProvider(cal.provider);
  const tokenManager = new CalendarTokenManager(provider);

  const { tokens } = await tokenManager.getValidTokens(cal.id, cal.oauth_state);

  // Step 3: Run conflict detection
  const conflicts = await detectConflictsForEvent({
    supabase,
    workspaceId,
    event: {
      id: event.id,
      clientCalendarId: event.client_calendar_id,
      startAt: event.start_at,
      endAt: event.end_at,
      providerEventId: event.provider_event_id,
      title: event.title,
    },
    accessToken: tokens.accessToken,
    calendarId: cal.calendar_id,
    provider,
  });

  // Step 4: Write signals if conflicts found
  if (conflicts.length > 0) {
    const correlationId = crypto.randomUUID();

    await writeConflictSignals({
      supabase,
      workspaceId,
      clientId: cal.client_id,
      conflicts,
      correlationId,
      causationId: null,
    });
  }

  // Step 5: Return summary
  const conflictEventIds = conflicts.map(
    (c) => c.event2.eventId,
  );

  return {
    conflictsFound: conflicts.length,
    conflictEventIds,
  };
}
