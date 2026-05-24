import type { SupabaseClient } from '@supabase/supabase-js';

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

interface EventRow {
  title: string;
  start_at: string;
  end_at: string;
  source: string;
  client_id: string | null;
}

interface ClientRow {
  id: string;
  name: string;
}

interface ConflictSignalRow {
  payload: Record<string, unknown>;
}

interface BypassMetricsRow {
  client_id: string;
  bypass_rate: string;
  total_events: number;
  bypass_count: number;
}

export async function generateDailyPreview(
  workspaceId: string,
  deps: DailyPreviewDeps,
): Promise<DailyPreviewPayload> {
  const { supabase } = deps;
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0] ?? new Date().toISOString().slice(0, 10);
  const dayStart = new Date(today);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(today);
  dayEnd.setHours(23, 59, 59, 999);

  const { data: eventData } = await supabase
    .from('calendar_events')
    .select('title, start_at, end_at, source, client_id')
    .eq('workspace_id', workspaceId)
    .gte('start_at', dayStart.toISOString())
    .lte('start_at', dayEnd.toISOString())
    .order('start_at', { ascending: true });

  const events = (eventData ?? []) as EventRow[];

  const clientIds = [...new Set(events.map((e) => e.client_id).filter(Boolean))] as string[];
  const clientMap = new Map<string, string>();

  const { data: bypassData } = await supabase
    .from('calendar_bypass_metrics')
    .select('client_id, bypass_rate, total_events, bypass_count')
    .eq('workspace_id', workspaceId)
    .gt('bypass_rate', 0.3);

  const bypassClientIds = [...new Set((bypassData ?? []).map((r: Record<string, unknown>) => r.client_id as string).filter(Boolean))];
  const allClientIds = [...new Set([...clientIds, ...bypassClientIds])];

  if (allClientIds.length > 0) {
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, name')
      .in('id', allClientIds);
    for (const c of (clientData ?? []) as ClientRow[]) {
      clientMap.set(c.id, c.name);
    }
  }

  const { data: conflictData } = await supabase
    .from('agent_signals')
    .select('payload')
    .eq('workspace_id', workspaceId)
    .eq('agent_id', 'calendar')
    .eq('signal_type', 'calendar.conflict.detected')
    .gte('created_at', dayStart.toISOString());

  const conflicts = ((conflictData ?? []) as ConflictSignalRow[]).map((row) => ({
    eventTitle: (row.payload.event1Title as string) ?? 'Unknown',
    conflictTitle: (row.payload.event2Title as string) ?? 'Unknown',
    startAt: (row.payload.detectedAt as string) ?? dayStart.toISOString(),
  }));

  const bypassAlerts = ((bypassData ?? []) as BypassMetricsRow[]).map((row) => ({
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

  const { error } = await supabase
    .from('agent_signals')
    .insert({
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
