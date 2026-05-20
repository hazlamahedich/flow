import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectConflictsForEvent } from '../conflict-detection';
import type { ConflictDetectionParams } from '../conflict-detection';
import type { CalendarProvider, ConflictDetectionResult } from '../../providers/calendar-provider';

// --- Mocks ---

function createQueryBuilder(resolvedValue: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.gt = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockImplementation(() => chain);
  // The final call in the chain resolves the query
  chain.gt = vi.fn().mockImplementation(() => resolvedValue);
  chain.lt = vi.fn().mockImplementation(() => chain);
  // .gt('end_at', now) is the last call and resolves
  // But the query is: .select().eq().neq().gt().lt().gt()
  // The second .gt() is terminal
  let gtCallCount = 0;
  chain.gt = vi.fn().mockImplementation(() => {
    gtCallCount++;
    if (gtCallCount === 2) return resolvedValue;
    return chain;
  });
  return chain;
}

const mockDetectConflicts = vi.fn<() => Promise<ConflictDetectionResult>>();

const mockProvider = {
  detectConflicts: mockDetectConflicts,
} as unknown as CalendarProvider;

// --- Helpers ---

function makeParams(overrides?: Partial<ConflictDetectionParams['event']>): ConflictDetectionParams {
  const baseEvent = {
    id: 'evt-1',
    clientCalendarId: 'cal-1',
    startAt: '2026-06-01T10:00:00Z',
    endAt: '2026-06-01T11:00:00Z',
    providerEventId: 'prov-evt-1',
    title: 'Team Meeting',
  };
  return {
    supabase: {} as import('@supabase/supabase-js').SupabaseClient,
    workspaceId: 'ws-1',
    event: { ...baseEvent, ...overrides },
    accessToken: 'test-token',
    calendarId: 'google-cal-1',
    provider: mockProvider,
  };
}

describe('detectConflictsForEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects overlapping events from DB', async () => {
    const rows = [
      {
        id: 'evt-2',
        provider_event_id: 'prov-evt-2',
        title: 'Client Call',
        client_calendar_id: 'cal-2',
        start_at: '2026-06-01T10:30:00Z',
        end_at: '2026-06-01T11:30:00Z',
      },
    ];
    const chain = createQueryBuilder({ data: rows, error: null });
    const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as import('@supabase/supabase-js').SupabaseClient;
    mockDetectConflicts.mockResolvedValue({ hasConflicts: false, conflicts: [] });

    const result = await detectConflictsForEvent({ ...makeParams(), supabase });

    expect(result).toHaveLength(1);
    expect(result[0]!.overlapSeconds).toBeGreaterThan(0);
    expect(result[0]!.event2.title).toBe('Client Call');
  });

  it('does not flag non-overlapping events', async () => {
    const chain = createQueryBuilder({ data: [], error: null });
    const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as import('@supabase/supabase-js').SupabaseClient;
    mockDetectConflicts.mockResolvedValue({ hasConflicts: false, conflicts: [] });

    const result = await detectConflictsForEvent({ ...makeParams(), supabase });

    expect(result).toHaveLength(0);
  });

  it('does not flag events at exact boundary (start=end)', async () => {
    const chain = createQueryBuilder({ data: [], error: null });
    const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as import('@supabase/supabase-js').SupabaseClient;
    mockDetectConflicts.mockResolvedValue({ hasConflicts: false, conflicts: [] });

    const result = await detectConflictsForEvent({
      ...makeParams({ endAt: '2026-06-01T10:00:00Z' }),
      supabase,
    });

    expect(result).toHaveLength(0);
  });

  it('merges free/busy API results with DB results', async () => {
    const rows = [
      {
        id: 'evt-2',
        provider_event_id: 'prov-evt-2',
        title: 'DB Conflict',
        client_calendar_id: 'cal-2',
        start_at: '2026-06-01T10:30:00Z',
        end_at: '2026-06-01T11:30:00Z',
      },
    ];
    const chain = createQueryBuilder({ data: rows, error: null });
    const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as import('@supabase/supabase-js').SupabaseClient;

    mockDetectConflicts.mockResolvedValue({
      hasConflicts: true,
      conflicts: [
        { eventId: 'prov-evt-2', title: 'DB Conflict', startTime: '2026-06-01T10:30:00Z', endTime: '2026-06-01T11:30:00Z' },
        { eventId: 'prov-evt-3', title: 'Provider-Only Conflict', startTime: '2026-06-01T10:45:00Z', endTime: '2026-06-01T11:15:00Z' },
      ],
    });

    const result = await detectConflictsForEvent({ ...makeParams(), supabase });

    expect(result).toHaveLength(2);
    const titles = result.map((r) => r.event2.title);
    expect(titles).toContain('DB Conflict');
    expect(titles).toContain('Provider-Only Conflict');
  });

  it('returns DB-only results when provider call times out', async () => {
    const rows = [
      {
        id: 'evt-2',
        provider_event_id: 'prov-evt-2',
        title: 'DB Conflict',
        client_calendar_id: 'cal-2',
        start_at: '2026-06-01T10:30:00Z',
        end_at: '2026-06-01T11:30:00Z',
      },
    ];
    const chain = createQueryBuilder({ data: rows, error: null });
    const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as import('@supabase/supabase-js').SupabaseClient;
    mockDetectConflicts.mockRejectedValue(new Error('Timeout'));

    const result = await detectConflictsForEvent({ ...makeParams(), supabase });

    expect(result).toHaveLength(1);
    expect(result[0]!.event2.title).toBe('DB Conflict');
  });

  it('throws on DB query failure', async () => {
    const chain = createQueryBuilder({ data: null, error: { message: 'Connection refused' } });
    const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as import('@supabase/supabase-js').SupabaseClient;

    await expect(detectConflictsForEvent({ ...makeParams(), supabase })).rejects.toThrow(
      'Failed to query overlapping events',
    );
  });
});
