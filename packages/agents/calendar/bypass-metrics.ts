import type { SupabaseClient } from '@supabase/supabase-js';

export interface UpsertBypassMetricsParams {
  supabase: SupabaseClient;
  workspaceId: string;
  clientId: string;
}

interface BypassMetricsRow {
  id: string;
  total_events: number;
  bypass_count: number;
  bypass_rate: string;
  window_start: string;
  window_end: string;
}

const WINDOW_DAYS = 30;

export function getRollingWindow(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - WINDOW_DAYS);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function upsertBypassMetrics(
  params: UpsertBypassMetricsParams,
): Promise<{ bypassRate: number; bypassCount: number; totalEvents: number }> {
  const { supabase, workspaceId, clientId } = params;
  const window = getRollingWindow();

  const { data: existing, error: fetchError } = await supabase
    .from('calendar_bypass_metrics')
    .select('id, total_events, bypass_count, bypass_rate, window_start, window_end')
    .eq('workspace_id', workspaceId)
    .eq('client_id', clientId)
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    throw Object.assign(
      new Error(`Failed to fetch bypass metrics: ${fetchError.message}`),
      { code: 'METRICS_FETCH_FAILED' as const, statusCode: 500 },
    );
  }

  if (existing) {
    const row = existing as BypassMetricsRow;
    const newTotal = row.total_events + 1;
    const newBypassCount = row.bypass_count + 1;
    const newRate = newTotal > 0 ? newBypassCount / newTotal : 0;

    const { error: updateError, data: updated } = await supabase
      .from('calendar_bypass_metrics')
      .update({
        total_events: newTotal,
        bypass_count: newBypassCount,
        bypass_rate: newRate.toFixed(4),
        window_end: window.end,
      })
      .eq('id', row.id)
      .eq('total_events', row.total_events)
      .select('id, total_events, bypass_count, bypass_rate')
      .maybeSingle();

    if (updateError) {
      throw Object.assign(
        new Error(`Failed to update bypass metrics: ${updateError.message}`),
        { code: 'METRICS_UPDATE_FAILED' as const, statusCode: 500 },
      );
    }

    if (!updated) {
      return upsertBypassMetrics(params);
    }

    const finalRow = updated as BypassMetricsRow;
    const finalRate = finalRow.total_events > 0 ? finalRow.bypass_count / finalRow.total_events : 0;
    return { bypassRate: finalRate, bypassCount: finalRow.bypass_count, totalEvents: finalRow.total_events };
  }

  const newRate = 1;
  const { error: insertError } = await supabase
    .from('calendar_bypass_metrics')
    .upsert({
      workspace_id: workspaceId,
      client_id: clientId,
      total_events: 1,
      bypass_count: 1,
      bypass_rate: newRate.toFixed(4),
      window_start: window.start,
      window_end: window.end,
    }, { onConflict: 'workspace_id,client_id,window_start', ignoreDuplicates: true });

  if (insertError) {
    const { data: retryData } = await supabase
      .from('calendar_bypass_metrics')
      .select('id, total_events, bypass_count, bypass_rate')
      .eq('workspace_id', workspaceId)
      .eq('client_id', clientId)
      .order('window_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (retryData) {
      const retryRow = retryData as BypassMetricsRow;
      const rTotal = retryRow.total_events + 1;
      const rBypass = retryRow.bypass_count + 1;
      const rRate = rTotal > 0 ? rBypass / rTotal : 0;

      const { error: retryUpdateError } = await supabase
        .from('calendar_bypass_metrics')
        .update({
          total_events: rTotal,
          bypass_count: rBypass,
          bypass_rate: rRate.toFixed(4),
          window_end: window.end,
        })
        .eq('id', retryRow.id);

      if (retryUpdateError) {
        throw Object.assign(
          new Error(`Failed to update bypass metrics on retry: ${retryUpdateError.message}`),
          { code: 'METRICS_UPDATE_FAILED' as const, statusCode: 500 },
        );
      }

      return { bypassRate: rRate, bypassCount: rBypass, totalEvents: rTotal };
    }

    throw Object.assign(
      new Error(`Failed to insert bypass metrics: ${insertError.message}`),
      { code: 'METRICS_INSERT_FAILED' as const, statusCode: 500 },
    );
  }

  return { bypassRate: newRate, bypassCount: 1, totalEvents: 1 };
}

export async function incrementTotalEvents(
  supabase: SupabaseClient,
  workspaceId: string,
  clientId: string,
): Promise<void> {
  const window = getRollingWindow();

  const { data: existing, error: fetchError } = await supabase
    .from('calendar_bypass_metrics')
    .select('id, total_events, bypass_count, bypass_rate')
    .eq('workspace_id', workspaceId)
    .eq('client_id', clientId)
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    throw Object.assign(
      new Error(`Failed to fetch metrics for total increment: ${fetchError.message}`),
      { code: 'METRICS_FETCH_FAILED' as const, statusCode: 500 },
    );
  }

  if (existing) {
    const row = existing as BypassMetricsRow;
    const newTotal = row.total_events + 1;
    const newRate = newTotal > 0 ? row.bypass_count / newTotal : 0;

    const { error: updateError } = await supabase
      .from('calendar_bypass_metrics')
      .update({
        total_events: newTotal,
        bypass_rate: newRate.toFixed(4),
        window_end: window.end,
      })
      .eq('id', row.id);

    if (updateError) {
      throw Object.assign(
        new Error(`Failed to increment total events: ${updateError.message}`),
        { code: 'METRICS_UPDATE_FAILED' as const, statusCode: 500 },
      );
    }
  }
}

export async function getBypassMetricsForClient(
  supabase: SupabaseClient,
  workspaceId: string,
  clientId: string,
): Promise<BypassMetricsRow | null> {
  const { data } = await supabase
    .from('calendar_bypass_metrics')
    .select('id, total_events, bypass_count, bypass_rate, window_start, window_end')
    .eq('workspace_id', workspaceId)
    .eq('client_id', clientId)
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as BypassMetricsRow | null;
}
