import type { SupabaseClient } from '@supabase/supabase-js';
import type { OAuthStateEncrypted } from '@flow/types';
import type { CalendarProvider } from '../providers/calendar-provider.js';
import { findAvailableSlots } from './slot-finder.js';
import type { BookingProposalResult, BookingProposal } from './types.js';
import { getCalendarProvider } from '../providers/registry.js';
import { CalendarTokenManager } from '../providers/google-calendar/token-manager.js';
import { resolveOriginatingSignal } from './signal-resolution.js';

export interface ProposeBookingInput {
  workspaceId: string;
  schedulingRequestId: string;
}

export interface ProposeBookingDeps {
  supabase: SupabaseClient;
}

interface SchedulingRequestRow {
  id: string;
  workspace_id: string;
  client_id: string;
  status: string;
  duration_minutes: number | null;
  preferences: Record<string, unknown>;
  source_email_id: string | null;
}

interface CalendarRow {
  id: string;
  client_id: string | null;
  calendar_id: string;
  provider: string;
  oauth_state: Record<string, unknown>;
  sync_status: string;
}

interface SignalRow {
  id: string;
}

export async function executeProposeBooking(
  runId: string,
  input: ProposeBookingInput,
  deps: ProposeBookingDeps,
): Promise<BookingProposalResult> {
  const { supabase } = deps;
  const { workspaceId, schedulingRequestId } = input;
  void runId;

  const { data: reqRow, error: reqError } = await supabase
    .from('scheduling_requests')
    .select('id, workspace_id, client_id, status, duration_minutes, preferences, source_email_id')
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

  if (req.status !== 'pending') {
    throw Object.assign(
      new Error(`Invalid status: ${req.status}, expected pending`),
      { code: 'INVALID_STATUS' as const, statusCode: 400 },
    );
  }

  let result: BookingProposalResult;
  try {
    const { data: calRows } = await supabase
      .from('client_calendars')
      .select('id, client_id, calendar_id, provider, oauth_state, sync_status')
      .eq('workspace_id', workspaceId)
      .eq('sync_status', 'connected');

    const calendars: Array<{
      id: string;
      calendarId: string;
      provider: CalendarProvider;
      accessToken: string;
    }> = [];

    for (const cal of (calRows ?? []) as CalendarRow[]) {
      try {
        const provider = getCalendarProvider(cal.provider);
        const tokenManager = new CalendarTokenManager(provider);
        const { tokens } = await tokenManager.getValidTokens(cal.id, cal.oauth_state as unknown as OAuthStateEncrypted);
        calendars.push({ id: cal.id, calendarId: cal.calendar_id, provider, accessToken: tokens.accessToken });
      } catch { continue; }
    }

    const durationMinutes = req.duration_minutes ?? 30;
    const slots = await findAvailableSlots(
      {
        workspaceId,
        clientId: req.client_id,
        durationMinutes,
        preferences: req.preferences,
        calendars,
      },
      { supabase },
    );

    const causationId = crypto.randomUUID();

    if (slots.length === 0) {
      await supabase
        .from('scheduling_requests')
        .update({ status: 'failed' })
        .eq('id', schedulingRequestId)
        .eq('workspace_id', workspaceId);

      await supabase.from('agent_signals').insert({
        correlation_id: crypto.randomUUID(),
        causation_id: causationId,
        agent_id: 'calendar',
        signal_type: 'no_availability',
        payload: { clientId: req.client_id, schedulingRequestId },
        target_agent: 'calendar',
        workspace_id: workspaceId,
      });

      result = { schedulingRequestId, proposedOptions: [], status: 'failed' };
    } else {
      const proposedOptions: BookingProposal[] = slots.map((slot) => ({
        startAt: slot.startAt,
        endAt: slot.endAt,
        conflicts: slot.conflicts,
        reasoning: slot.reasoning,
      }));

      await supabase
        .from('scheduling_requests')
        .update({
          proposed_options: proposedOptions as unknown as Record<string, unknown>[],
          status: 'options_proposed',
        })
        .eq('id', schedulingRequestId)
        .eq('workspace_id', workspaceId);

      await supabase.from('agent_signals').insert({
        correlation_id: crypto.randomUUID(),
        causation_id: causationId,
        agent_id: 'calendar',
        signal_type: 'booking_proposal_created',
        payload: { clientId: req.client_id, schedulingRequestId },
        target_agent: 'calendar',
        workspace_id: workspaceId,
      });

      result = { schedulingRequestId, proposedOptions, status: 'options_proposed' };
    }
  } catch (err: unknown) {
    await supabase
      .from('scheduling_requests')
      .update({ status: 'failed' })
      .eq('id', schedulingRequestId)
      .eq('workspace_id', workspaceId);
    await resolveOriginatingSignal(supabase, workspaceId, req.source_email_id);
    throw err;
  }

  await resolveOriginatingSignal(supabase, workspaceId, req.source_email_id);
  return result;
}
