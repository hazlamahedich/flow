import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_CALENDAR_CONFIG } from './config.js';
import { upsertBypassMetrics } from './bypass-metrics.js';

export interface DetectBypassInput {
  workspaceId: string;
  eventId: string;
  clientId: string;
  eventCreatedAt: string;
}

export interface DetectBypassDeps {
  supabase: SupabaseClient;
}

export interface DetectBypassOutput {
  isBypass: boolean;
  bypassRate: number;
  bypassCount: number;
  totalEvents: number;
  signalEmitted: boolean;
}

const LOOKBACK_HOURS = 24;

export async function executeDetectBypass(
  runId: string,
  input: DetectBypassInput,
  deps: DetectBypassDeps,
): Promise<DetectBypassOutput> {
  const { supabase } = deps;
  const { workspaceId, eventId, clientId, eventCreatedAt } = input;
  void runId;

  const lookbackStart = new Date(eventCreatedAt);
  lookbackStart.setHours(lookbackStart.getHours() - LOOKBACK_HOURS);

  const { data: requests } = await supabase
    .from('scheduling_requests')
    .select('id, status, created_at')
    .eq('workspace_id', workspaceId)
    .eq('client_id', clientId)
    .in('status', ['booked', 'option_selected'])
    .gte('created_at', lookbackStart.toISOString())
    .lte('created_at', eventCreatedAt)
    .limit(1);

  const hasMatchingRequest = (requests ?? []).length > 0;

  if (hasMatchingRequest) {
    return { isBypass: false, bypassRate: 0, bypassCount: 0, totalEvents: 0, signalEmitted: false };
  }

  const metrics = await upsertBypassMetrics({
    supabase,
    workspaceId,
    clientId,
  });

  let signalEmitted = false;
  if (metrics.bypassRate > DEFAULT_CALENDAR_CONFIG.bypassAlertThreshold) {
    const today = new Date().toISOString().split('T')[0];
    const dedupKey = `cal.bypass:${clientId}:${today}`;

    const { error: signalError } = await supabase
      .from('agent_signals')
      .insert({
        correlation_id: crypto.randomUUID(),
        causation_id: crypto.randomUUID(),
        agent_id: 'calendar',
        signal_type: 'calendar.bypass.detected',
        payload: {
          client_id: clientId,
          bypass_count: metrics.bypassCount,
          bypass_rate: metrics.bypassRate,
          recent_event_id: eventId,
        },
        target_agent: 'inbox',
        client_id: clientId,
        workspace_id: workspaceId,
        dedup_key: dedupKey,
      });

    if (!signalError) {
      signalEmitted = true;
    }
  }

  return {
    isBypass: true,
    bypassRate: metrics.bypassRate,
    bypassCount: metrics.bypassCount,
    totalEvents: metrics.totalEvents,
    signalEmitted,
  };
}
