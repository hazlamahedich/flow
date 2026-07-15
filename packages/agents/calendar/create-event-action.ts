import type { SupabaseClient } from '@supabase/supabase-js';
import type { OAuthStateEncrypted } from '@flow/types';
import type { CreateEventResult, BookingProposal } from './types.js';
import { getCalendarProvider } from '../providers/registry.js';
import { CalendarTokenManager } from '../providers/google-calendar/token-manager.js';
import { resolveOriginatingSignal } from './signal-resolution.js';
import { withTimeout } from './provider-utils.js';
import { writeRescheduledFromRelation } from './event-relations.js';

export interface CreateEventActionInput {
  workspaceId: string;
  schedulingRequestId: string;
  selectedOptionIndex: number;
}

export interface CreateEventActionDeps {
  supabase: SupabaseClient;
}

interface SchedulingRequestRow {
  id: string;
  workspace_id: string;
  client_id: string;
  status: string;
  request_type: string;
  proposed_options: BookingProposal[];
  selected_option: number | null;
  duration_minutes: number | null;
  requested_by: Record<string, unknown>;
  source_email_id: string | null;
  booked_event_id: string | null;
}

interface CalendarRow {
  id: string;
  calendar_id: string;
  provider: string;
  oauth_state: Record<string, unknown>;
}

const PROVIDER_TIMEOUT_MS = 30_000;

export async function executeCreateEvent(
  runId: string,
  input: CreateEventActionInput,
  deps: CreateEventActionDeps,
): Promise<CreateEventResult> {
  const { supabase } = deps;
  const { workspaceId, schedulingRequestId } = input;

  const { data: reqRow, error: reqError } = await supabase
    .from('scheduling_requests')
    .select(
      'id, workspace_id, client_id, status, request_type, proposed_options, selected_option, duration_minutes, requested_by, source_email_id, booked_event_id',
    )
    .eq('id', schedulingRequestId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (reqError || !reqRow) {
    throw Object.assign(
      new Error(`Scheduling request not found: ${schedulingRequestId}`),
      { code: 'REQUEST_NOT_FOUND' as const, statusCode: 404 },
    );
  }

  const req = reqRow as SchedulingRequestRow;

  if (req.status !== 'option_selected') {
    throw Object.assign(
      new Error(`Invalid status: ${req.status}, expected option_selected`),
      { code: 'INVALID_STATUS' as const, statusCode: 400 },
    );
  }

  const dbSelectedOption = req.selected_option ?? 0;
  const selectedOption = req.proposed_options[dbSelectedOption];
  if (!selectedOption) {
    throw Object.assign(
      new Error(`Invalid option index: ${dbSelectedOption}`),
      { code: 'INVALID_OPTION' as const, statusCode: 400 },
    );
  }

  const { data: calRows } = await supabase
    .from('client_calendars')
    .select('id, calendar_id, provider, oauth_state')
    .eq('workspace_id', workspaceId)
    .eq('sync_status', 'connected')
    .limit(1);

  const cal = (calRows ?? []) as CalendarRow[];
  if (cal.length === 0) {
    await supabase
      .from('scheduling_requests')
      .update({ status: 'failed' })
      .eq('id', schedulingRequestId);
    await resolveOriginatingSignal(supabase, workspaceId, req.source_email_id);
    throw Object.assign(new Error('No connected calendar found'), {
      code: 'CALENDAR_NOT_FOUND' as const,
      statusCode: 404,
    });
  }

  const calendar = cal[0]!;

  try {
    const provider = getCalendarProvider(calendar.provider);
    const tokenManager = new CalendarTokenManager(provider);
    const { tokens } = await tokenManager.getValidTokens(
      calendar.id,
      calendar.oauth_state as unknown as OAuthStateEncrypted,
    );

    const title = `Meeting with ${req.requested_by.name ?? req.requested_by.email ?? 'Client'}`;
    const attendeeEmail = req.requested_by.email;
    const attendees: Array<{ email: string; name?: string }> = attendeeEmail
      ? [{ email: attendeeEmail as string }]
      : [];
    const createdEvent = await withTimeout(
      provider.createEvent(tokens.accessToken, {
        calendarId: calendar.calendar_id,
        title,
        startTime: selectedOption.startAt,
        endTime: selectedOption.endAt,
        attendees,
      }),
      PROVIDER_TIMEOUT_MS,
    );

    const { data: eventRow, error: eventInsertError } = await supabase
      .from('calendar_events')
      .insert({
        workspace_id: workspaceId,
        client_calendar_id: calendar.id,
        client_id: req.client_id,
        provider_event_id: createdEvent.providerEventId,
        title: createdEvent.title,
        description: createdEvent.description,
        start_at: createdEvent.startTime,
        end_at: createdEvent.endTime,
        is_all_day: false,
        attendees: createdEvent.attendees,
        event_type: 'meeting',
        source: 'va_created',
        created_via: 'agent:calendar',
      })
      .select('id')
      .maybeSingle();

    if (eventInsertError || !eventRow) {
      try {
        await provider.deleteEvent(
          tokens.accessToken,
          calendar.calendar_id,
          createdEvent.providerEventId,
        );
      } catch {
        /* best-effort cleanup — provider event may be orphaned */
      }
      await supabase
        .from('scheduling_requests')
        .update({ status: 'failed' })
        .eq('id', schedulingRequestId)
        .eq('workspace_id', workspaceId);
      await resolveOriginatingSignal(
        supabase,
        workspaceId,
        req.source_email_id,
      );
      throw Object.assign(
        new Error(
          `calendar_events insert failed: ${eventInsertError?.message ?? 'no row returned'}`,
        ),
        { code: 'EVENT_STORE_FAILED' as const, statusCode: 500 },
      );
    }

    await supabase
      .from('scheduling_requests')
      .update({
        booked_event_id: eventRow.id,
        status: 'booked',
      })
      .eq('id', schedulingRequestId)
      .eq('workspace_id', workspaceId);

    if (req.request_type === 'reschedule' && req.booked_event_id) {
      try {
        await writeRescheduledFromRelation(
          req.booked_event_id,
          eventRow.id,
          supabase,
        );
      } catch {
        /* best-effort — relation writing is non-blocking */
      }
    }

    await supabase.from('agent_signals').insert({
      correlation_id: crypto.randomUUID(),
      causation_id: crypto.randomUUID(),
      agent_id: 'calendar',
      signal_type: 'booking_completed',
      payload: {
        clientId: req.client_id,
        eventId: eventRow.id,
        startAt: selectedOption.startAt,
      },
      target_agent: 'calendar',
      workspace_id: workspaceId,
    });

    await resolveOriginatingSignal(supabase, workspaceId, req.source_email_id);

    return {
      schedulingRequestId,
      eventId: eventRow.id,
      providerEventId: createdEvent.providerEventId,
      status: 'booked',
    };
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'EVENT_STORE_FAILED') throw err;

    await supabase
      .from('scheduling_requests')
      .update({ status: 'failed' })
      .eq('id', schedulingRequestId)
      .eq('workspace_id', workspaceId);

    await resolveOriginatingSignal(supabase, workspaceId, req.source_email_id);

    const message =
      err instanceof Error ? err.message : 'Event creation failed';
    throw Object.assign(new Error(message), {
      code: 'PROVIDER_ERROR' as const,
      statusCode: 500,
    });
  }
}
