import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeConflictDetection } from '../detect-conflict-action';
import type {
  ConflictDetectionInput,
  ConflictDetectionDeps,
} from '../detect-conflict-action';

vi.mock('../conflict-detection', () => ({
  detectConflictsForEvent: vi.fn(),
}));

vi.mock('../conflict-signals', () => ({
  writeConflictSignals: vi.fn(),
}));

vi.mock('../../providers/google-calendar/token-manager');

import { detectConflictsForEvent } from '../conflict-detection';
import { writeConflictSignals } from '../conflict-signals';
import { CalendarTokenManager } from '../../providers/google-calendar/token-manager';

const mockDetectConflicts = vi.mocked(detectConflictsForEvent);
const mockWriteConflictSignals = vi.mocked(writeConflictSignals);

function createChain(finalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  return chain;
}

function createMockSupabase(
  eventResult: { data: unknown; error: unknown },
  calResult: { data: unknown; error: unknown },
) {
  let fromCallCount = 0;
  return {
    from: vi.fn((_table: string) => {
      fromCallCount++;
      if (fromCallCount === 1) return createChain(eventResult);
      return createChain(calResult);
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(CalendarTokenManager).mockImplementation(
    () =>
      ({
        getValidTokens: vi
          .fn()
          .mockResolvedValue({ tokens: { accessToken: 'valid-token' } }),
      }) as unknown as CalendarTokenManager,
  );
});

const baseInput: ConflictDetectionInput = {
  workspaceId: 'ws-1',
  eventId: 'evt-1',
  clientCalendarId: 'cal-1',
};

describe('executeConflictDetection', () => {
  it('throws EVENT_NOT_FOUND when event missing', async () => {
    const supabase = createMockSupabase(
      { data: null, error: null },
      { data: null, error: null },
    );
    const deps: ConflictDetectionDeps = { supabase };

    await expect(
      executeConflictDetection('run-1', baseInput, deps),
    ).rejects.toMatchObject({ code: 'EVENT_NOT_FOUND', statusCode: 404 });
  });

  it('throws EVENT_NOT_FOUND on event fetch error', async () => {
    const supabase = createMockSupabase(
      { data: null, error: { message: 'DB error' } },
      { data: null, error: null },
    );
    const deps: ConflictDetectionDeps = { supabase };

    await expect(
      executeConflictDetection('run-1', baseInput, deps),
    ).rejects.toMatchObject({ code: 'EVENT_NOT_FOUND', statusCode: 404 });
  });

  it('throws CALENDAR_NOT_FOUND when calendar missing', async () => {
    const supabase = createMockSupabase(
      {
        data: {
          id: 'evt-1',
          client_calendar_id: 'cal-1',
          provider_event_id: 'p-1',
          title: 'Test',
          start_at: '2026-06-01T10:00:00Z',
          end_at: '2026-06-01T11:00:00Z',
        },
        error: null,
      },
      { data: null, error: null },
    );
    const deps: ConflictDetectionDeps = { supabase };

    await expect(
      executeConflictDetection('run-1', baseInput, deps),
    ).rejects.toMatchObject({ code: 'CALENDAR_NOT_FOUND', statusCode: 404 });
  });

  it('returns zero conflicts when none detected', async () => {
    const supabase = createMockSupabase(
      {
        data: {
          id: 'evt-1',
          client_calendar_id: 'cal-1',
          provider_event_id: 'p-1',
          title: 'Test',
          start_at: '2026-06-01T10:00:00Z',
          end_at: '2026-06-01T11:00:00Z',
        },
        error: null,
      },
      {
        data: {
          id: 'cal-1',
          client_id: 'client-1',
          calendar_id: 'gcal-1',
          provider: 'google_calendar',
          oauth_state: {},
          sync_status: 'connected',
        },
        error: null,
      },
    );
    mockDetectConflicts.mockResolvedValue([]);
    const deps: ConflictDetectionDeps = { supabase };

    const result = await executeConflictDetection('run-1', baseInput, deps);

    expect(result.conflictsFound).toBe(0);
    expect(result.conflictEventIds).toHaveLength(0);
    expect(mockWriteConflictSignals).not.toHaveBeenCalled();
  });

  it('writes signals and returns conflict summary', async () => {
    const supabase = createMockSupabase(
      {
        data: {
          id: 'evt-1',
          client_calendar_id: 'cal-1',
          provider_event_id: 'p-1',
          title: 'Test',
          start_at: '2026-06-01T10:00:00Z',
          end_at: '2026-06-01T11:00:00Z',
        },
        error: null,
      },
      {
        data: {
          id: 'cal-1',
          client_id: 'client-1',
          calendar_id: 'gcal-1',
          provider: 'google_calendar',
          oauth_state: {},
          sync_status: 'connected',
        },
        error: null,
      },
    );
    mockDetectConflicts.mockResolvedValue([
      {
        event1: {
          eventId: 'evt-1',
          providerEventId: 'prov-1',
          title: 'Event 1',
          calendarId: 'cal-1',
          startAt: new Date('2026-06-01T10:00:00Z'),
          endAt: new Date('2026-06-01T11:00:00Z'),
        },
        event2: {
          eventId: 'evt-2',
          providerEventId: 'prov-2',
          title: 'Conflict',
          calendarId: 'cal-1',
          startAt: new Date('2026-06-01T10:15:00Z'),
          endAt: new Date('2026-06-01T11:15:00Z'),
        },
        overlapSeconds: 1800,
      },
    ]);
    const deps: ConflictDetectionDeps = { supabase };

    const result = await executeConflictDetection('run-1', baseInput, deps);

    expect(result.conflictsFound).toBe(1);
    expect(result.conflictEventIds).toContain('evt-2');
    expect(mockWriteConflictSignals).toHaveBeenCalledTimes(1);
  });
});
