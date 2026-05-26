import { describe, it, expect, beforeEach, vi } from 'vitest';
import { writeEventRelation, writeRescheduledFromRelation, findDependentEvents } from '../event-relations';

const mockUpsert = vi.fn();
const mockSelect = vi.fn();

function createMockSupabase() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'calendar_event_relations') {
        return {
          upsert: mockUpsert,
          select: mockSelect,
        };
      }
      if (table === 'calendar_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [{ id: 'evt-1' }, { id: 'evt-2' }] }),
            }),
          }),
        };
      }
      return { select: vi.fn(), insert: vi.fn() };
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('writeEventRelation', () => {
  it('upserts a relation record', async () => {
    mockUpsert.mockResolvedValue({ error: null });
    const supabase = createMockSupabase();

    await writeEventRelation({
      parentEventId: 'evt-1',
      childEventId: 'evt-2',
      relationType: 'rescheduled_from',
      supabase,
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_event_id: 'evt-1',
        child_event_id: 'evt-2',
        relation_type: 'rescheduled_from',
      }),
      expect.objectContaining({ onConflict: expect.any(String) }),
    );
  });

  it('throws on upsert error', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'constraint violation' } });
    const supabase = createMockSupabase();

    await expect(
      writeEventRelation({
        parentEventId: 'evt-1',
        childEventId: 'evt-2',
        relationType: 'rescheduled_from',
        supabase,
      }),
    ).rejects.toThrow('Failed to write event relation');
  });
});

describe('writeRescheduledFromRelation', () => {
  it('delegates to writeEventRelation with rescheduled_from type', async () => {
    mockUpsert.mockResolvedValue({ error: null });
    const supabase = createMockSupabase();

    await writeRescheduledFromRelation('old-evt', 'new-evt', supabase);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_event_id: 'old-evt',
        child_event_id: 'new-evt',
        relation_type: 'rescheduled_from',
      }),
      expect.any(Object),
    );
  });
});

describe('findDependentEvents', () => {
  it('queries for relations matching event ID', async () => {
    const mockData = [
      { id: 'r-1', parent_event_id: 'evt-1', child_event_id: 'evt-2', relation_type: 'rescheduled_from' },
    ];
    mockSelect.mockReturnValue({
      or: vi.fn().mockResolvedValue({ data: mockData }),
    });
    const supabase = createMockSupabase();

    const result = await findDependentEvents('evt-1', 'ws-1', supabase);

    expect(result).toHaveLength(1);
    expect(result[0]!.relationType).toBe('rescheduled_from');
  });

  it('returns empty array when no relations found', async () => {
    mockSelect.mockReturnValue({
      or: vi.fn().mockResolvedValue({ data: [] }),
    });
    const supabase = createMockSupabase();

    const result = await findDependentEvents('evt-1', 'ws-1', supabase);

    expect(result).toHaveLength(0);
  });

  it('throws on query error', async () => {
    mockSelect.mockReturnValue({
      or: vi.fn().mockResolvedValue({ error: { message: 'query failed' } }),
    });
    const supabase = createMockSupabase();

    await expect(findDependentEvents('evt-1', 'ws-1', supabase)).rejects.toThrow();
  });
});
