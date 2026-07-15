vi.mock('@flow/db/vault/calendar-tokens', () => ({
  decryptCalendarTokens: vi.fn().mockReturnValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiryDate: Date.now() + 3600000,
    scope: 'mock-scope',
    tokenType: 'Bearer',
  }),
  rotateCalendarTokens: vi.fn(),
}));

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeCascadeOption } from '../cascade-executor';
import type { CascadeOption } from '../resolve-cascade-action';

function createMockSupabase(
  calendarData: Record<string, unknown>[] = [
    {
      id: 'cal-1',
      calendar_id: 'gcal-1',
      provider: 'google_calendar',
      oauth_state: {},
    },
  ],
  eventData: Record<string, unknown>[] = [],
  signalInsertResult: { error: unknown } = { error: null },
) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'client_calendars') {
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockImplementation(() => {
          if (chain.eq.mock.calls.length === 2) {
            chain.limit = vi
              .fn()
              .mockResolvedValue({ data: calendarData, error: null });
          }
          return chain;
        });
        chain.limit = vi
          .fn()
          .mockResolvedValue({ data: calendarData, error: null });
        return chain;
      }
      if (table === 'calendar_events') {
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.in = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockResolvedValue({ data: eventData, error: null });
        return chain;
      }
      if (table === 'agent_signals') {
        return {
          insert: vi.fn().mockResolvedValue(signalInsertResult),
        };
      }
      if (table === 'agent_runs') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

const mockProvider = {
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
};

function getProvider(_name: string) {
  return mockProvider as unknown as import('../providers/calendar-provider').CalendarProvider;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockProvider.updateEvent.mockResolvedValue(undefined);
  mockProvider.deleteEvent.mockResolvedValue(undefined);
});

const baseOption: CascadeOption = {
  id: 'opt-1',
  affectedEvents: [
    { eventId: 'evt-2', action: 'reschedule' },
    { eventId: 'evt-3', action: 'cancel' },
  ],
  description: 'Test cascade option',
};

const baseEventData = [
  {
    id: 'evt-2',
    title: 'Meeting A',
    start_at: '2026-06-01T10:00:00Z',
    end_at: '2026-06-01T11:00:00Z',
    provider_event_id: 'prov-2',
    client_calendar_id: 'cal-1',
  },
  {
    id: 'evt-3',
    title: 'Meeting B',
    start_at: '2026-06-01T14:00:00Z',
    end_at: '2026-06-01T15:00:00Z',
    provider_event_id: 'prov-3',
    client_calendar_id: 'cal-1',
  },
];

describe('executeCascadeOption', () => {
  it('returns empty result when no events need action', async () => {
    const option: CascadeOption = {
      id: 'opt-1',
      affectedEvents: [{ eventId: 'evt-1', action: 'keep' }],
      description: 'Keep all',
    };
    const supabase = createMockSupabase();

    const result = await executeCascadeOption(
      'run-1',
      'ws-1',
      option,
      supabase,
      getProvider,
    );

    expect(result.success).toBe(true);
    expect(result.executed).toHaveLength(0);
    expect(result.rolledBack).toHaveLength(0);
  });

  it('throws CALENDAR_NOT_FOUND when no connected calendars', async () => {
    const supabase = createMockSupabase([]);

    await expect(
      executeCascadeOption('run-1', 'ws-1', baseOption, supabase, getProvider),
    ).rejects.toMatchObject({ code: 'CALENDAR_NOT_FOUND', statusCode: 404 });
  });

  it('executes update and delete for affected events', async () => {
    const supabase = createMockSupabase(undefined, baseEventData);

    const result = await executeCascadeOption(
      'run-1',
      'ws-1',
      baseOption,
      supabase,
      getProvider,
    );

    expect(result.success).toBe(true);
    expect(result.executed).toHaveLength(2);
    expect(result.executed[0]!.action).toBe('reschedule');
    expect(result.executed[1]!.action).toBe('cancel');
    expect(mockProvider.updateEvent).toHaveBeenCalledTimes(1);
    expect(mockProvider.deleteEvent).toHaveBeenCalledTimes(1);
  });

  it('rolls back on provider failure', async () => {
    const supabase = createMockSupabase(undefined, baseEventData);
    mockProvider.deleteEvent.mockRejectedValueOnce(new Error('Provider down'));

    await expect(
      executeCascadeOption('run-1', 'ws-1', baseOption, supabase, getProvider),
    ).rejects.toMatchObject({ code: 'CASCADE_PARTIAL_FAILURE' });

    expect(mockProvider.updateEvent).toHaveBeenCalledTimes(2);
  });

  it('emits cascade signal on success', async () => {
    const supabase = createMockSupabase(undefined, baseEventData);

    await executeCascadeOption(
      'run-1',
      'ws-1',
      baseOption,
      supabase,
      getProvider,
    );

    expect(supabase.from).toHaveBeenCalledWith('agent_signals');
  });

  it('throws CASCADE_SIGNAL_FAILED when signal insert fails', async () => {
    const supabase = createMockSupabase(undefined, baseEventData, {
      error: { message: 'Insert failed' },
    });

    await expect(
      executeCascadeOption('run-1', 'ws-1', baseOption, supabase, getProvider),
    ).rejects.toMatchObject({ code: 'CASCADE_SIGNAL_FAILED' });
  });

  it('skips events not found in DB', async () => {
    const partialData = [
      {
        id: 'evt-2',
        title: 'Meeting A',
        start_at: '2026-06-01T10:00:00Z',
        end_at: '2026-06-01T11:00:00Z',
        provider_event_id: 'prov-2',
        client_calendar_id: 'cal-1',
      },
    ];
    const supabase = createMockSupabase(undefined, partialData);

    const result = await executeCascadeOption(
      'run-1',
      'ws-1',
      baseOption,
      supabase,
      getProvider,
    );

    expect(result.success).toBe(true);
    expect(result.executed).toHaveLength(1);
  });

  it('continues rollback attempts after individual rollback failure', async () => {
    const supabase = createMockSupabase(undefined, baseEventData);
    mockProvider.deleteEvent.mockRejectedValueOnce(new Error('Provider down'));
    let updateCallCount = 0;
    mockProvider.updateEvent.mockImplementation(() => {
      updateCallCount++;
      if (updateCallCount === 1) return Promise.resolve(undefined);
      if (updateCallCount === 2)
        return Promise.reject(new Error('Rollback failed'));
      return Promise.resolve(undefined);
    });

    await expect(
      executeCascadeOption('run-1', 'ws-1', baseOption, supabase, getProvider),
    ).rejects.toThrow(/Cascade execution failed/);

    expect(mockProvider.updateEvent).toHaveBeenCalledTimes(2);
  });
});
