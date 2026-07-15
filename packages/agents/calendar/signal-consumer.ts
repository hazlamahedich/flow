import type { SupabaseClient } from '@supabase/supabase-js';
import { SchedulingRequestSchema } from './schemas.js';
import type { SchedulingRequest } from './types.js';

export interface SignalConsumerDeps {
  supabase: SupabaseClient;
}

export interface ConsumedSchedulingResult {
  schedulingRequest: SchedulingRequest | null;
  status: 'created' | 'no_client_match' | 'unknown_action' | 'duplicate';
}

interface ClientRow {
  id: string;
}

interface SchedulingRequestRow {
  id: string;
  workspace_id: string;
  client_id: string;
  source_email_id: string | null;
  source_type: string;
  request_type: string;
  requested_by: Record<string, unknown>;
  requested_slots: Record<string, unknown>[] | null;
  duration_minutes: number | null;
  preferences: Record<string, unknown>;
  status: string;
  proposed_options: Record<string, unknown>[];
  selected_option: number | null;
  booked_event_id: string | null;
  agent_run_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

function mapRowToRequest(row: SchedulingRequestRow): SchedulingRequest {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    clientId: row.client_id,
    sourceEmailId: row.source_email_id,
    sourceType: row.source_type as SchedulingRequest['sourceType'],
    requestType: row.request_type as SchedulingRequest['requestType'],
    requestedBy: row.requested_by,
    requestedSlots: row.requested_slots,
    durationMinutes: row.duration_minutes,
    preferences: row.preferences,
    status: row.status as SchedulingRequest['status'],
    proposedOptions:
      row.proposed_options as unknown as SchedulingRequest['proposedOptions'],
    selectedOption: row.selected_option,
    bookedEventId: row.booked_event_id,
    agentRunId: row.agent_run_id,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function consumeSchedulingSignal(
  signal: {
    id: string;
    workspaceId: string;
    payload: Record<string, unknown>;
    entityId?: string | null;
  },
  deps: SignalConsumerDeps,
): Promise<ConsumedSchedulingResult> {
  const { supabase } = deps;
  const { workspaceId, payload } = signal;

  const actionType = payload.actionType ?? payload.action_type;
  if (actionType !== 'schedule_meeting' && actionType !== 'reschedule') {
    return { schedulingRequest: null, status: 'unknown_action' };
  }

  const senderEmail = payload.senderEmail ?? payload.sender_email ?? '';
  const senderName = payload.senderName ?? payload.sender_name ?? '';
  if (!senderEmail && !senderName) {
    return { schedulingRequest: null, status: 'no_client_match' };
  }
  const duration = typeof payload.duration === 'number' ? payload.duration : 30;
  const timezone =
    (typeof payload.timezone === 'string' ? payload.timezone : null) ?? 'UTC';

  let clientQuery = supabase
    .from('clients')
    .select('id')
    .eq('workspace_id', workspaceId);
  if (senderEmail) {
    clientQuery = clientQuery.eq('email', senderEmail);
  } else if (senderName) {
    clientQuery = clientQuery.ilike('name', `%${senderName}%`);
  }
  const { data: clientRows } = await clientQuery.limit(1);

  if (!clientRows || clientRows.length === 0) {
    await supabase.from('agent_signals').insert({
      correlation_id: crypto.randomUUID(),
      causation_id: signal.id,
      agent_id: 'calendar',
      signal_type: 'no_client_match',
      payload: { senderEmail, senderName, workspaceId },
      target_agent: 'calendar',
      workspace_id: workspaceId,
    });
    return { schedulingRequest: null, status: 'no_client_match' };
  }

  const clientId = (clientRows as ClientRow[])[0]!.id;
  const requestType = actionType === 'reschedule' ? 'reschedule' : 'book_new';
  const rawSourceEmailId =
    signal.entityId ??
    ((payload.emailId ?? payload.email_id ?? null) as string | null);
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const sourceEmailId =
    rawSourceEmailId && uuidRegex.test(rawSourceEmailId)
      ? rawSourceEmailId
      : null;

  const parsed = SchedulingRequestSchema.safeParse({
    workspaceId,
    clientId,
    sourceEmailId: sourceEmailId ?? undefined,
    sourceType: 'email_extraction',
    requestType,
    requestedBy: { email: senderEmail, name: senderName, timezone },
    durationMinutes: duration,
    preferences: { timezone },
  });

  if (!parsed.success) {
    return { schedulingRequest: null, status: 'unknown_action' };
  }

  let dedupQuery = supabase
    .from('scheduling_requests')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('request_type', requestType);
  if (sourceEmailId) {
    dedupQuery = dedupQuery.eq('source_email_id', sourceEmailId);
  } else {
    dedupQuery = dedupQuery.is('source_email_id', null);
  }
  const { data: existing } = await dedupQuery.maybeSingle();

  if (existing) {
    return { schedulingRequest: null, status: 'duplicate' };
  }

  const insertPayload = {
    workspace_id: workspaceId,
    client_id: clientId,
    source_email_id: sourceEmailId ?? null,
    source_type: 'email_extraction',
    request_type: requestType,
    requested_by: parsed.data.requestedBy,
    duration_minutes: parsed.data.durationMinutes ?? null,
    preferences: parsed.data.preferences,
    status: 'pending',
  };

  const { data: inserted, error: insertError } = await supabase
    .from('scheduling_requests')
    .insert(insertPayload)
    .select('*')
    .maybeSingle();

  if (insertError || !inserted) {
    if (insertError?.code === '23505') {
      return { schedulingRequest: null, status: 'duplicate' };
    }
    return { schedulingRequest: null, status: 'unknown_action' };
  }

  return {
    schedulingRequest: mapRowToRequest(inserted as SchedulingRequestRow),
    status: 'created',
  };
}
