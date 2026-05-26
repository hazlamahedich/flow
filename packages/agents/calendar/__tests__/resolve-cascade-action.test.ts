import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeResolveCascade } from '../resolve-cascade-action';
import type { ResolveCascadeInput } from '../resolve-cascade-action';

function createMockSupabase(
  originEvent: Record<string, unknown> | null = null,
  relations: Record<string, unknown>[] = [],
  dependentEvents: Record<string, unknown>[] = [],
  proximityEvents: Record<string, unknown>[] = [],
) {
  const hasRelations = relations.length > 0;

  const eqEqNeqChain = {
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: proximityEvents }),
          }),
        }),
      }),
    }),
  };

  const originChain = {
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: originEvent }),
      }),
    }),
  };

  const dependentChain = {
    in: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: dependentEvents }),
    }),
  };

  const allRelationEventIds = [...new Set(relations.flatMap((r: Record<string, unknown>) => [r.parent_event_id as string, r.child_event_id as string]))];
  const workspaceFilterChain = {
    eq: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: allRelationEventIds.map((id: string) => ({ id })) }),
    }),
  };

  let eventSelectCall = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === 'calendar_events') {
        return {
          select: vi.fn().mockImplementation(() => {
            eventSelectCall++;
            if (eventSelectCall === 1) return originChain;
            if (hasRelations && eventSelectCall === 2) return workspaceFilterChain;
            if (hasRelations && eventSelectCall === 3) return dependentChain;
            if (!hasRelations && eventSelectCall === 2) return eqEqNeqChain;
            return eqEqNeqChain;
          }),
        };
      }
      if (table === 'calendar_event_relations') {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ data: relations }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'agent_signals') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return { select: vi.fn() };
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeResolveCascade', () => {
  const baseInput: ResolveCascadeInput = {
    workspaceId: 'ws-1',
    originEventId: 'evt-1',
    clientId: 'client-1',
    action: 'cancelled',
  };

  it('throws when origin event not found', async () => {
    const supabase = createMockSupabase(null);

    await expect(
      executeResolveCascade('run-1', baseInput, { supabase }),
    ).rejects.toThrow('Origin event not found');
  });

  it('returns empty options when no dependent events and no proximity matches', async () => {
    const origin = {
      id: 'evt-1', client_calendar_id: 'cal-1', provider_event_id: 'p-1',
      title: 'Meeting', start_at: '2026-05-24T10:00:00Z',
      end_at: '2026-05-24T11:00:00Z', source: 'va_created', created_via: 'flow_os',
    };
    const supabase = createMockSupabase(origin, [], [], []);

    const result = await executeResolveCascade('run-1', baseInput, { supabase });

    expect(result.affectedCount).toBe(0);
    expect(result.options).toHaveLength(0);
  });

  it('generates 2 options when dependent events found via relations', async () => {
    const origin = {
      id: 'evt-1', client_calendar_id: 'cal-1', provider_event_id: 'p-1',
      title: 'Meeting', start_at: '2026-05-24T10:00:00Z',
      end_at: '2026-05-24T11:00:00Z', source: 'va_created', created_via: 'flow_os',
    };
    const relations = [
      { id: 'r-1', parent_event_id: 'evt-1', child_event_id: 'evt-2', relation_type: 'rescheduled_from' },
    ];
    const deps = [
      { id: 'evt-2', client_calendar_id: 'cal-1', provider_event_id: 'p-2', title: 'Follow-up', start_at: '2026-05-24T11:00:00Z', end_at: '2026-05-24T12:00:00Z', source: 'client_created', created_via: null },
    ];
    const supabase = createMockSupabase(origin, relations, deps, []);
    const inputNoClient = { ...baseInput, clientId: null };

    const result = await executeResolveCascade('run-1', inputNoClient, { supabase });

    expect(result.affectedCount).toBe(1);
    expect(result.options).toHaveLength(3);
    expect(result.options[0]!.id).toBe('free-block');
    expect(result.options[1]!.id).toBe('move-to-vacated');
    expect(result.options[2]!.id).toBe('keep-as-is');
  });

  it('emits cascade_triggered signal on proposal creation', async () => {
    const origin = {
      id: 'evt-1', client_calendar_id: 'cal-1', provider_event_id: 'p-1',
      title: 'Meeting', start_at: '2026-05-24T10:00:00Z',
      end_at: '2026-05-24T11:00:00Z', source: 'va_created', created_via: 'flow_os',
    };
    const relations = [
      { id: 'r-1', parent_event_id: 'evt-1', child_event_id: 'evt-2', relation_type: 'rescheduled_from' },
    ];
    const deps = [
      { id: 'evt-2', client_calendar_id: 'cal-1', provider_event_id: 'p-2', title: 'Follow-up', start_at: '2026-05-24T11:00:00Z', end_at: '2026-05-24T12:00:00Z', source: 'client_created', created_via: null },
    ];
    const supabase = createMockSupabase(origin, relations, deps, []);
    const inputNoClient = { ...baseInput, clientId: null };

    await executeResolveCascade('run-1', inputNoClient, { supabase });

    expect(supabase.from).toHaveBeenCalledWith('agent_signals');
  });
});