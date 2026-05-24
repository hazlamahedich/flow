import type { SupabaseClient } from '@supabase/supabase-js';
import { findDependentEvents } from './event-relations.js';

export interface ResolveCascadeInput {
  workspaceId: string;
  originEventId: string;
  clientId: string | null;
  action: 'cancelled' | 'rescheduled';
  newStartAt?: string | null;
  newEndAt?: string | null;
}

export interface ResolveCascadeDeps {
  supabase: SupabaseClient;
}

export interface CascadeOption {
  id: string;
  label: string;
  affectedEvents: AffectedEvent[];
}

export interface AffectedEvent {
  eventId: string;
  title: string;
  startAt: string;
  endAt: string;
  action: 'cancel' | 'reschedule' | 'keep';
}

export interface ResolveCascadeOutput {
  options: CascadeOption[];
  affectedCount: number;
}

export interface CascadeExecutionResult {
  success: boolean;
  executed: Array<{ eventId: string; action: string }>;
  rolledBack: Array<{ eventId: string; action: string }>;
}

interface EventRow {
  id: string;
  client_calendar_id: string;
  provider_event_id: string;
  title: string;
  start_at: string;
  end_at: string;
  source: string;
  created_via: string | null;
}

const PROXIMITY_HOURS = 2;

export async function executeResolveCascade(
  runId: string,
  input: ResolveCascadeInput,
  deps: ResolveCascadeDeps,
): Promise<ResolveCascadeOutput> {
  const { supabase } = deps;
  const { workspaceId, originEventId, clientId } = input;
  void runId;

  const { data: originRow } = await supabase
    .from('calendar_events')
    .select('id, client_calendar_id, provider_event_id, title, start_at, end_at, source, created_via')
    .eq('id', originEventId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!originRow) {
    throw Object.assign(
      new Error(`Origin event not found: ${originEventId}`),
      { code: 'EVENT_NOT_FOUND' as const, statusCode: 404 },
    );
  }

  const origin = originRow as EventRow;

  const relatedEvents = await findDependentEvents(originEventId, supabase);
  const relatedEventIds = relatedEvents.map((r) =>
    r.parentEventId === originEventId ? r.childEventId : r.parentEventId,
  );

  const affectedEventIds = [...relatedEventIds];

  if (clientId) {
    const originStart = new Date(origin.start_at);
    const proximityStart = new Date(originStart);
    proximityStart.setHours(proximityStart.getHours() - PROXIMITY_HOURS);
    const proximityEnd = new Date(originStart);
    proximityEnd.setHours(proximityEnd.getHours() + PROXIMITY_HOURS);

    const { data: proximityEvents } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('client_id', clientId)
      .neq('id', originEventId)
      .gte('start_at', proximityStart.toISOString())
      .lte('start_at', proximityEnd.toISOString());

    for (const row of (proximityEvents ?? []) as Array<{ id: string }>) {
      if (!affectedEventIds.includes(row.id)) {
        affectedEventIds.push(row.id);
      }
    }
  }

  if (affectedEventIds.length === 0) {
    return { options: [], affectedCount: 0 };
  }

  const { data: eventData } = await supabase
    .from('calendar_events')
    .select('id, client_calendar_id, provider_event_id, title, start_at, end_at, source, created_via')
    .in('id', affectedEventIds)
    .eq('workspace_id', workspaceId);

  const events = (eventData ?? []) as EventRow[];

  const affected: AffectedEvent[] = events.map((ev) => ({
    eventId: ev.id,
    title: ev.title,
    startAt: ev.start_at,
    endAt: ev.end_at,
    action: 'keep' as const,
  }));

  const option1: CascadeOption = {
    id: 'free-block',
    label: 'Free affected block',
    affectedEvents: affected.map((e) => ({ ...e, action: 'cancel' as const })),
  };

  const option2: CascadeOption = {
    id: 'keep-as-is',
    label: 'Keep all as-is (no changes)',
    affectedEvents: affected.map((e) => ({ ...e, action: 'keep' as const })),
  };

  const options = [option1, option2];

  await emitProposalSignal(supabase, workspaceId, originEventId, affected);

  return { options, affectedCount: affected.length };
}

async function emitProposalSignal(
  supabase: SupabaseClient,
  workspaceId: string,
  originEventId: string,
  affectedEvents: AffectedEvent[],
): Promise<void> {
  const dedupKey = `cal.cascade:${originEventId}:proposed`;

  const { error } = await supabase
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
        status: 'proposed',
      },
      target_agent: 'inbox',
      workspace_id: workspaceId,
      dedup_key: dedupKey,
    });

  if (error) {
    throw Object.assign(
      new Error(`Failed to emit cascade proposal signal: ${error.message}`),
      { code: 'CASCADE_SIGNAL_FAILED' as const, statusCode: 500 },
    );
  }
}
