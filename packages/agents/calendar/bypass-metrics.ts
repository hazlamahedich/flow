import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { BypassMetricsRowSchema, BypassMetricsSummarySchema } from './schemas.js';

export interface UpsertBypassMetricsParams {
  supabase: SupabaseClient;
  workspaceId: string;
  clientId: string;
}

const WINDOW_DAYS = 30;
const MAX_RETRIES = 3;

export function getRollingWindow(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - WINDOW_DAYS);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function upsertBypassMetrics(
  params: UpsertBypassMetricsParams,
): Promise<{ bypassRate: number; bypassCount: number; totalEvents: number }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const result = await tryUpsertBypassMetrics(params);
    if (result !== null) return result;
  }
  throw Object.assign(
    new Error('Failed to upsert bypass metrics after max retries'),
    { code: 'METRICS_CONFLICT_RETRY_EXCEEDED' as const, statusCode: 409 },
  );
}

async function tryUpsertBypassMetrics(
  params: UpsertBypassMetricsParams,
): Promise<{ bypassRate: number; bypassCount: number; totalEvents: number } | null> {
  const { supabase, workspaceId, clientId } = params;
  const window = getRollingWindow();

  const { data: rawExisting, error: fetchError } = await supabase
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

  if (rawExisting) {
    const parsed = BypassMetricsRowSchema.safeParse(rawExisting);
    if (!parsed.success) {
      throw Object.assign(
        new Error(`Invalid bypass metrics row: ${parsed.error.message}`),
        { code: 'METRICS_PARSE_FAILED' as const, statusCode: 500 },
      );
    }
    const row = parsed.data;
    const newTotal = row.total_events + 1;
    const newBypassCount = row.bypass_count + 1;
    const newRate = newTotal > 0 ? newBypassCount / newTotal : 0;

    const { error: updateError, data: rawUpdated } = await supabase
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

    if (!rawUpdated) {
      return null;
    }

    const updatedParsed = BypassMetricsSummarySchema.safeParse(rawUpdated);
    if (!updatedParsed.success) {
      throw Object.assign(
        new Error(`Invalid updated bypass metrics: ${updatedParsed.error.message}`),
        { code: 'METRICS_PARSE_FAILED' as const, statusCode: 500 },
      );
    }
    const finalRow = updatedParsed.data;
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
    return null;
  }

  return { bypassRate: newRate, bypassCount: 1, totalEvents: 1 };
}

export async function incrementTotalEvents(
  supabase: SupabaseClient,
  workspaceId: string,
  clientId: string,
): Promise<void> {
  const window = getRollingWindow();

  const { data: rawExisting, error: fetchError } = await supabase
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

  if (rawExisting) {
    const parsed = BypassMetricsSummarySchema.safeParse(rawExisting);
    if (!parsed.success) {
      throw Object.assign(
        new Error(`Invalid metrics row for increment: ${parsed.error.message}`),
        { code: 'METRICS_PARSE_FAILED' as const, statusCode: 500 },
      );
    }
    const row = parsed.data;
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
): Promise<z.infer<typeof BypassMetricsRowSchema> | null> {
  const { data: rawData } = await supabase
    .from('calendar_bypass_metrics')
    .select('id, total_events, bypass_count, bypass_rate, window_start, window_end')
    .eq('workspace_id', workspaceId)
    .eq('client_id', clientId)
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!rawData) return null;
  return BypassMetricsRowSchema.parse(rawData);
}
