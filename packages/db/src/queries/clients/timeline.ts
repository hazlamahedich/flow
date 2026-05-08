import type { SupabaseClient } from '@supabase/supabase-js';
import type { TimelineEvent, EmailTimelineEntry, AgentRunTimelineEntry } from '@flow/types';

interface GetClientEngagementTimelineInput {
  workspaceId: string;
  clientId: string;
  eventType?: 'all' | 'emails' | 'agent_runs';
  dateFrom?: string;
  dateTo?: string;
  cursor?: string | null;
  limit?: number;
}

export async function getClientEngagementTimeline(
  supabase: SupabaseClient,
  input: GetClientEngagementTimelineInput,
): Promise<{ events: TimelineEvent[]; nextCursor: string | null; hasMore: boolean }> {
  const {
    workspaceId,
    clientId,
    eventType = 'all',
    dateFrom,
    dateTo,
    cursor,
    limit = 50,
  } = input;

  let cursorTimestamp: string | null = null;
  let cursorId: string | null = null;
  let cursorKind: string | null = null;

  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
      if (
        typeof decoded.timestamp === 'string' && decoded.timestamp.length > 0 &&
        typeof decoded.id === 'string' && decoded.id.length > 0 &&
        typeof decoded.kind === 'string' && decoded.kind.length > 0
      ) {
        cursorTimestamp = decoded.timestamp;
        cursorId = decoded.id;
        cursorKind = decoded.kind;
      }
    } catch (e) {
      console.error('Failed to parse timeline cursor', e);
    }
  }

  const { data, error } = await supabase.rpc('get_client_engagement_timeline', {
    p_workspace_id: workspaceId,
    p_client_id: clientId,
    p_event_type: eventType,
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_cursor_timestamp: cursorTimestamp,
    p_cursor_id: cursorId,
    p_cursor_kind: cursorKind,
    p_limit: limit + 1,
  });

  if (error) throw error;

  type RpcRow = { kind: 'email' | 'agent_run'; id: string; sort_timestamp: string; data: unknown };
  const results = (data ?? []) as RpcRow[];
  const hasMore = results.length > limit;
  const items = results.slice(0, limit);

  const events: TimelineEvent[] = items.map((row): TimelineEvent => {
    if (row.kind === 'email') {
      return { kind: 'email', sortKey: row.sort_timestamp, data: row.data as EmailTimelineEntry };
    }
    return { kind: 'agent_run', sortKey: row.sort_timestamp, data: row.data as AgentRunTimelineEntry };
  });

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1]!;
    nextCursor = Buffer.from(
      JSON.stringify({
        timestamp: lastItem.sort_timestamp,
        id: lastItem.id,
        kind: lastItem.kind,
      }),
    ).toString('base64');
  }

  return {
    events,
    nextCursor,
    hasMore,
  };
}
