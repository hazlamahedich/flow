import { describe, it, expect, beforeEach, vi } from 'vitest';
import { performInitialSync } from '../initial-sync';
import type { InitialSyncParams } from '../initial-sync';

vi.mock('../../providers/google-calendar/google-calendar-provider', () => ({
  GoogleCalendarProvider: vi.fn(),
}));

vi.mock('../enqueue-bypass-detection', () => ({
  enqueueBypassDetection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../enqueue-conflict-detection', () => ({
  enqueueConflictDetection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../bypass-metrics', () => ({
  incrementTotalEvents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../classify-source', () => ({
  classifyEventSource: vi.fn().mockReturnValue('client_created'),
}));

import { GoogleCalendarProvider } from '../../providers/google-calendar/google-calendar-provider';

function createFullChain(finalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  return chain;
}

function createMockSupabase(
  calendarState: { data: Record<string, unknown> | null; error: unknown } = {
    data: {
      id: 'cc-1',
      oauth_state: {},
      sync_status: 'connected',
      updated_at: null,
    },
    error: null,
  },
  upsertResult: { data: Array<{ id: string }> | null; error: unknown } = {
    data: [{ id: 'evt-1' }],
    error: null,
  },
) {
  const chain = {
    ...createFullChain(calendarState),
  };
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(calendarState);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue({
    select: vi.fn().mockResolvedValue(upsertResult),
  });

  return {
    from: vi.fn((_table: string) => chain),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('performInitialSync', () => {
  const baseParams: Omit<InitialSyncParams, 'supabase'> = {
    workspaceId: 'ws-1',
    clientCalendarId: 'cc-1',
    accessToken: 'token-1',
    calendarId: 'gcal-1',
    provider: 'google_calendar',
  };

  it('returns early when calendar not found', async () => {
    vi.mocked(GoogleCalendarProvider).mockImplementation(
      () =>
        ({
          listEvents: vi.fn().mockResolvedValue([]),
        }) as unknown as GoogleCalendarProvider,
    );
    const supabase = createMockSupabase({ data: null, error: null });

    await performInitialSync({ ...baseParams, supabase });

    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('returns early when calendar is disconnected', async () => {
    vi.mocked(GoogleCalendarProvider).mockImplementation(
      () =>
        ({
          listEvents: vi.fn().mockResolvedValue([]),
        }) as unknown as GoogleCalendarProvider,
    );
    const supabase = createMockSupabase({
      data: {
        id: 'cc-1',
        oauth_state: {},
        sync_status: 'disconnected',
        updated_at: null,
      },
      error: null,
    });

    await performInitialSync({ ...baseParams, supabase });

    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('completes sync successfully with empty events', async () => {
    vi.mocked(GoogleCalendarProvider).mockImplementation(
      () =>
        ({
          listEvents: vi.fn().mockResolvedValue([]),
        }) as unknown as GoogleCalendarProvider,
    );
    const supabase = createMockSupabase(undefined, { data: [], error: null });

    await performInitialSync({ ...baseParams, supabase });

    expect(supabase.from).toHaveBeenCalled();
  });

  it('marks calendar as error on provider failure', async () => {
    vi.mocked(GoogleCalendarProvider).mockImplementation(
      () =>
        ({
          listEvents: vi.fn().mockRejectedValue(new Error('API timeout')),
        }) as unknown as GoogleCalendarProvider,
    );
    const supabase = createMockSupabase();

    await expect(
      performInitialSync({ ...baseParams, supabase }),
    ).rejects.toThrow('API timeout');
  });

  it('continues on batch upsert failure', async () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      providerEventId: `pe-${i}`,
      title: `Event ${i}`,
      startTime: '2026-05-01T10:00:00Z',
      endTime: '2026-05-01T11:00:00Z',
      isAllDay: false,
      attendees: [],
    }));
    vi.mocked(GoogleCalendarProvider).mockImplementation(
      () =>
        ({
          listEvents: vi.fn().mockResolvedValue(events),
        }) as unknown as GoogleCalendarProvider,
    );
    const supabase = createMockSupabase(undefined, {
      data: null,
      error: { message: 'Batch failed' },
    });

    await performInitialSync({ ...baseParams, supabase });

    expect(supabase.from).toHaveBeenCalled();
  });
});
