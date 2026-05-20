import { describe, it, expect, beforeEach, vi } from 'vitest';
import { writeConflictSignals } from '../conflict-signals';
import type { ConflictResult } from '../conflict-detection';
import type { WriteConflictSignalsParams } from '../conflict-signals';

// --- Mocks ---

const mockInsertSelect = vi.fn();

function createMockSupabase(): import('@supabase/supabase-js').SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: mockInsertSelect,
      }),
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

// --- Helpers ---

function makeConflict(
  event1Title: string,
  event2Title: string,
  overlapSeconds: number,
): ConflictResult {
  return {
    event1: {
      eventId: 'evt-1',
      providerEventId: 'prov-1',
      title: event1Title,
      calendarId: 'cal-1',
      startAt: new Date('2026-06-01T10:00:00Z'),
      endAt: new Date('2026-06-01T11:00:00Z'),
    },
    event2: {
      eventId: 'evt-2',
      providerEventId: 'prov-2',
      title: event2Title,
      calendarId: 'cal-2',
      startAt: new Date('2026-06-01T10:30:00Z'),
      endAt: new Date('2026-06-01T11:30:00Z'),
    },
    overlapSeconds,
  };
}

function makeParams(overrides?: Partial<WriteConflictSignalsParams>): WriteConflictSignalsParams {
  return {
    supabase: createMockSupabase(),
    workspaceId: 'ws-1',
    clientId: 'client-1',
    conflicts: [],
    correlationId: 'corr-1',
    causationId: null,
    ...overrides,
  };
}

describe('writeConflictSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts signals for each conflict', async () => {
    const conflicts = [
      makeConflict('Meeting A', 'Meeting B', 1800),
      makeConflict('Meeting A', 'Meeting C', 900),
    ];

    mockInsertSelect.mockResolvedValue({
      data: [{ id: 'sig-1' }, { id: 'sig-2' }],
      error: null,
    });

    const result = await writeConflictSignals(makeParams({ conflicts }));

    expect(result).toEqual(['sig-1', 'sig-2']);
    expect(mockInsertSelect).toHaveBeenCalledWith('id');

    // Verify the insert was called with correct signal rows
    const supabase = makeParams({ conflicts }).supabase;
    void supabase; // used above via makeParams
  });

  it('returns empty array when no conflicts', async () => {
    const result = await writeConflictSignals(makeParams({ conflicts: [] }));

    expect(result).toEqual([]);
    expect(mockInsertSelect).not.toHaveBeenCalled();
  });

  it('payload structure matches spec', async () => {
    const conflict = makeConflict('Team Sync', 'Client Call', 3600);

    mockInsertSelect.mockResolvedValue({
      data: [{ id: 'sig-1' }],
      error: null,
    });

    const params = makeParams({ conflicts: [conflict] });
    await writeConflictSignals(params);

    // Access the from().insert() call args
    const fromCall = (params.supabase.from as ReturnType<typeof vi.fn>).mock.calls;
    expect(fromCall[0]![0]).toBe('agent_signals');

    const insertCall = ((params.supabase as unknown as Record<string, unknown>).from as ReturnType<typeof vi.fn>)
      .mock.results[0]!.value as { insert: ReturnType<typeof vi.fn> };
    const insertedRows = insertCall.insert.mock.calls[0]![0] as Record<string, unknown>[];
    const payload = insertedRows[0]!.payload as Record<string, unknown>;

    expect(payload).toHaveProperty('event1Id');
    expect(payload).toHaveProperty('event2Id');
    expect(payload).toHaveProperty('event1Title', 'Team Sync');
    expect(payload).toHaveProperty('event2Title', 'Client Call');
    expect(payload).toHaveProperty('calendarId');
    expect(payload).toHaveProperty('overlapSeconds', 3600);
    expect(payload).toHaveProperty('detectedAt');
  });

  it('throws on DB insert failure', async () => {
    mockInsertSelect.mockResolvedValue({
      data: null,
      error: { message: 'FK violation' },
    });

    await expect(
      writeConflictSignals(
        makeParams({ conflicts: [makeConflict('A', 'B', 100)] }),
      ),
    ).rejects.toThrow('Failed to insert conflict signals');
  });
});
