import type { SupabaseClient } from '@supabase/supabase-js';
import {
  EventPreviewRowSchema,
  BypassMetricsForAlertSchema,
  ClientRowSchema,
  ConflictSignalRowSchema,
  WorkspaceRowSchema,
} from './schemas.js';

export interface DailyPreviewDeps {
  supabase: SupabaseClient;
}

export interface DailyPreviewPayload {
  date: string;
  events: Array<{
    title: string;
    startAt: string;
    endAt: string;
    clientName: string | null;
    source: string;
  }>;
  conflicts: Array<{
    eventTitle: string;
    conflictTitle: string;
    startAt: string;
  }>;
  bypassAlerts: Array<{
    clientName: string | null;
    bypassRate: number;
    recentEvent: string | null;
  }>;
  gaps: Array<{
    startAt: string;
    endAt: string;
    durationMinutes: number;
    suggestion: string;
  }>;
}

export async function generateDailyPreview(
  workspaceId: string,
  deps: DailyPreviewDeps,
): Promise<DailyPreviewPayload> {
  const { supabase } = deps;

  const { data: rawWsData } = await supabase
    .from('workspaces')
    .select('timezone')
    .eq('id', workspaceId)
    .single();

  const wsParsed = WorkspaceRowSchema.safeParse(rawWsData);
  const tz = wsParsed.success ? (wsParsed.data.timezone ?? 'UTC') : 'UTC';
  const now = new Date();
  const dateStr = now.toLocaleDateString('sv-SE', { timeZone: tz });
  const dayStart = new Date(`${dateStr}T00:00:00Z`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

  const { data: rawEventData } = await supabase
    .from('calendar_events')
    .select('title, start_at, end_at, source, client_id')
    .eq('workspace_id', workspaceId)
    .gte('start_at', dayStart.toISOString())
    .lte('start_at', dayEnd.toISOString())
    .order('start_at', { ascending: true });

  const events = (rawEventData ?? [])
    .map((row) => EventPreviewRowSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data);

  const eventClientIds = [
    ...new Set(events.map((e) => e.client_id).filter(Boolean)),
  ] as string[];

  const { data: rawBypassData } = await supabase
    .from('calendar_bypass_metrics')
    .select('client_id, bypass_rate, total_events, bypass_count')
    .eq('workspace_id', workspaceId)
    .gt('bypass_rate', 0.3);

  const bypassData = (rawBypassData ?? [])
    .map((row) => BypassMetricsForAlertSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data);

  const bypassClientIds = [...new Set(bypassData.map((r) => r.client_id))];
  const allClientIds = [...new Set([...eventClientIds, ...bypassClientIds])];

  const clientMap = new Map<string, string>();
  if (allClientIds.length > 0) {
    const { data: rawClientData } = await supabase
      .from('clients')
      .select('id, name')
      .in('id', allClientIds);
    for (const rawC of rawClientData ?? []) {
      const cParsed = ClientRowSchema.safeParse(rawC);
      if (cParsed.success) {
        clientMap.set(cParsed.data.id, cParsed.data.name);
      }
    }
  }

  const { data: rawConflictData } = await supabase
    .from('agent_signals')
    .select('payload')
    .eq('workspace_id', workspaceId)
    .eq('agent_id', 'calendar')
    .eq('signal_type', 'calendar.conflict.detected')
    .gte('created_at', dayStart.toISOString());

  const conflicts = (rawConflictData ?? [])
    .map((row) => ConflictSignalRowSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data)
    .map((row) => ({
      eventTitle: (row.payload.event1Title as string) ?? 'Unknown',
      conflictTitle: (row.payload.event2Title as string) ?? 'Unknown',
      startAt: (row.payload.detectedAt as string) ?? dayStart.toISOString(),
    }));

  const bypassAlerts = bypassData.map((row) => ({
    clientName: clientMap.get(row.client_id) ?? null,
    bypassRate: parseFloat(row.bypass_rate),
    recentEvent: null as string | null,
  }));

  const gaps: DailyPreviewPayload['gaps'] = [];
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );

  let cursor = dayStart;
  for (const event of sortedEvents) {
    const eventStart = new Date(event.start_at);
    const gapMinutes = (eventStart.getTime() - cursor.getTime()) / 60_000;
    if (gapMinutes >= 30) {
      gaps.push({
        startAt: cursor.toISOString(),
        endAt: eventStart.toISOString(),
        durationMinutes: Math.round(gapMinutes),
        suggestion: `${Math.round(gapMinutes)}-min gap available`,
      });
    }
    const eventEnd = new Date(event.end_at);
    if (eventEnd > cursor) {
      cursor = eventEnd;
    }
  }

  const endGapMinutes = (dayEnd.getTime() - cursor.getTime()) / 60_000;
  if (endGapMinutes >= 30) {
    gaps.push({
      startAt: cursor.toISOString(),
      endAt: dayEnd.toISOString(),
      durationMinutes: Math.round(endGapMinutes),
      suggestion: `${Math.round(endGapMinutes)}-min gap available`,
    });
  }

  return {
    date: dateStr,
    events: events.map((e) => ({
      title: e.title,
      startAt: e.start_at,
      endAt: e.end_at,
      clientName: e.client_id ? (clientMap.get(e.client_id) ?? null) : null,
      source: e.source,
    })),
    conflicts,
    bypassAlerts,
    gaps,
  };
}

export async function emitDailyPreviewSignal(
  workspaceId: string,
  deps: DailyPreviewDeps,
): Promise<void> {
  const preview = await generateDailyPreview(workspaceId, deps);
  const { supabase } = deps;

  const dateStr = preview.date;
  const dedupKey = `cal.preview:${workspaceId}:${dateStr}`;

  const { error } = await supabase.from('agent_signals').insert({
    correlation_id: crypto.randomUUID(),
    causation_id: crypto.randomUUID(),
    agent_id: 'calendar',
    signal_type: 'calendar.daily.preview',
    payload: preview,
    target_agent: 'inbox',
    workspace_id: workspaceId,
    dedup_key: dedupKey,
  });

  if (error) {
    throw Object.assign(
      new Error(`Failed to emit daily preview signal: ${error.message}`),
      { code: 'PREVIEW_SIGNAL_FAILED' as const, statusCode: 500 },
    );
  }
}
