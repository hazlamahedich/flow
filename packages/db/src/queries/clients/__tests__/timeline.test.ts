import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClientEngagementTimeline } from '../timeline';

type SupabaseClient = Parameters<typeof getClientEngagementTimeline>[0];

const mockSupabase = {
  rpc: vi.fn(),
};

function makeRow(kind: string, id: string, sortTimestamp: string, data: Record<string, unknown>) {
  return { kind, id, sort_timestamp: sortTimestamp, data };
}

describe('getClientEngagementTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the correct RPC with default parameters', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    await getClientEngagementTimeline(mockSupabase as unknown as SupabaseClient, {
      workspaceId: 'ws1',
      clientId: 'c1',
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_client_engagement_timeline', {
      p_workspace_id: 'ws1',
      p_client_id: 'c1',
      p_event_type: 'all',
      p_date_from: undefined,
      p_date_to: undefined,
      p_cursor_timestamp: null,
      p_cursor_id: null,
      p_cursor_kind: null,
      p_limit: 51,
    });
  });

  it('correctly parses and passes cursor parameters', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
    const cursor = Buffer.from(JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', id: 'uuid-1', kind: 'email' })).toString('base64');

    await getClientEngagementTimeline(mockSupabase as unknown as SupabaseClient, {
      workspaceId: 'ws1',
      clientId: 'c1',
      cursor,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_client_engagement_timeline', expect.objectContaining({
      p_cursor_timestamp: '2026-01-01T00:00:00Z',
      p_cursor_id: 'uuid-1',
      p_cursor_kind: 'email',
    }));
  });

  it('returns mapped events and computes nextCursor with hasMore', async () => {
    const mockData = [
      makeRow('email', 'e1', '2026-01-01T10:00:00Z', { id: 'e1', subject: 'Test' }),
      makeRow('agent_run', 'r1', '2026-01-01T09:00:00Z', { id: 'r1', agentId: 'inbox' }),
    ];
    mockSupabase.rpc.mockResolvedValue({ data: mockData, error: null });

    const result = await getClientEngagementTimeline(mockSupabase as unknown as SupabaseClient, {
      workspaceId: 'ws1',
      clientId: 'c1',
      limit: 1,
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.kind).toBe('email');
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeDefined();

    const decoded = JSON.parse(Buffer.from(result.nextCursor!, 'base64').toString('utf8'));
    expect(decoded.id).toBe('e1');
    expect(decoded.kind).toBe('email');
  });

  it('handles empty results (AC7)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    const result = await getClientEngagementTimeline(mockSupabase as unknown as SupabaseClient, {
      workspaceId: 'ws1',
      clientId: 'c1',
    });

    expect(result.events).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('handles emails-only results', async () => {
    const mockData = [
      makeRow('email', 'e1', '2026-01-01T10:00:00Z', { id: 'e1', subject: 'Email 1' }),
    ];
    mockSupabase.rpc.mockResolvedValue({ data: mockData, error: null });

    const result = await getClientEngagementTimeline(mockSupabase as unknown as SupabaseClient, {
      workspaceId: 'ws1',
      clientId: 'c1',
      eventType: 'emails',
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.kind).toBe('email');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_client_engagement_timeline', expect.objectContaining({
      p_event_type: 'emails',
    }));
  });

  it('handles agent_runs-only results', async () => {
    const mockData = [
      makeRow('agent_run', 'r1', '2026-01-01T10:00:00Z', { id: 'r1', agentId: 'inbox' }),
    ];
    mockSupabase.rpc.mockResolvedValue({ data: mockData, error: null });

    const result = await getClientEngagementTimeline(mockSupabase as unknown as SupabaseClient, {
      workspaceId: 'ws1',
      clientId: 'c1',
      eventType: 'agent_runs',
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.kind).toBe('agent_run');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_client_engagement_timeline', expect.objectContaining({
      p_event_type: 'agent_runs',
    }));
  });

  it('passes date range filter parameters', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

    await getClientEngagementTimeline(mockSupabase as unknown as SupabaseClient, {
      workspaceId: 'ws1',
      clientId: 'c1',
      dateFrom: '2026-01-01T00:00:00Z',
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_client_engagement_timeline', expect.objectContaining({
      p_date_from: '2026-01-01T00:00:00Z',
    }));
  });

  it('sorts by sort_timestamp descending (DB handles ordering)', async () => {
    const mockData = [
      makeRow('email', 'e1', '2026-01-01T10:00:00.000Z', { id: 'e1' }),
      makeRow('agent_run', 'r1', '2026-01-01T09:59:59.999Z', { id: 'r1' }),
    ];
    mockSupabase.rpc.mockResolvedValue({ data: mockData, error: null });

    const result = await getClientEngagementTimeline(mockSupabase as unknown as SupabaseClient, {
      workspaceId: 'ws1',
      clientId: 'c1',
      limit: 50,
    });

    expect(result.events).toHaveLength(2);
    expect(result.events[0]!.kind).toBe('email');
    expect(result.events[0]!.sortKey).toBe('2026-01-01T10:00:00.000Z');
    expect(result.events[1]!.kind).toBe('agent_run');
  });

  it('advances cursor correctly for page 2 (pagination)', async () => {
    const page1Data = Array.from({ length: 51 }, (_, i) =>
      makeRow('email', `e-${i}`, `2026-01-01T${String(10 - Math.floor(i / 6)).padStart(2, '0')}:${String((i * 10) % 60).padStart(2, '0')}:00Z`, { id: `e-${i}` })
    );
    mockSupabase.rpc.mockResolvedValue({ data: page1Data, error: null });

    const page1 = await getClientEngagementTimeline(mockSupabase as unknown as SupabaseClient, {
      workspaceId: 'ws1',
      clientId: 'c1',
      limit: 50,
    });

    expect(page1.events).toHaveLength(50);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeDefined();

    const decoded = JSON.parse(Buffer.from(page1.nextCursor!, 'base64').toString('utf8'));
    expect(decoded.kind).toBe('email');
  });

  it('throws on RPC error', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await expect(
      getClientEngagementTimeline(mockSupabase as unknown as SupabaseClient, {
        workspaceId: 'ws1',
        clientId: 'c1',
      }),
    ).rejects.toEqual({ message: 'RPC failed' });
  });
});
