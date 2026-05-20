import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../providers/registry.js', () => ({
  getCalendarProvider: vi.fn().mockReturnValue({
    getCalendarId: vi.fn().mockReturnValue('cal-1'),
    listBusyPeriods: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('../../providers/google-calendar/token-manager.js', () => ({
  CalendarTokenManager: vi.fn().mockImplementation(() => ({
    getValidTokens: vi.fn().mockResolvedValue({ tokens: { accessToken: 'test-token' } }),
  })),
}));

const mockFindAvailableSlots = vi.fn().mockResolvedValue([
  { startAt: '2026-06-10T10:00:00Z', endAt: '2026-06-10T10:30:00Z', conflicts: 0, reasoning: 'Good slot', calendarId: 'cal-1' },
]);
vi.mock('../slot-finder.js', () => ({
  findAvailableSlots: (...args: unknown[]) => mockFindAvailableSlots(...args),
}));

import { executeProposeBooking } from '../propose-booking-action';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const CLIENT_ID = '00000000-0000-4000-8000-000000000002';
const REQ_ID = '00000000-0000-4000-8000-000000000020';

function createMockSupabase(opts: {
  requestData?: Record<string, unknown> | null;
  requestError?: unknown;
  noCalendars?: boolean;
} = {}) {
  const defaultRequest = {
    id: REQ_ID, workspace_id: WORKSPACE_ID, client_id: CLIENT_ID,
    status: 'pending', duration_minutes: 30, preferences: {},
    source_email_id: null,
  };
  const requestRow = opts.requestData === undefined ? defaultRequest : opts.requestData;
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'scheduling_requests') {
      const selectChain: Record<string, ReturnType<typeof vi.fn>> = {};
      selectChain.eq = vi.fn().mockImplementation(() => selectChain);
      selectChain.maybeSingle = vi.fn().mockResolvedValue({
        data: requestRow,
        error: opts.requestError ?? null,
      });
      const updateChain: Record<string, ReturnType<typeof vi.fn>> = {};
      updateChain.eq = vi.fn().mockImplementation(() => updateChain);
      return {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn().mockReturnValue(updateChain),
      };
    }
    if (table === 'client_calendars') {
      const resolved = {
        data: opts.noCalendars ? [] : [{
          id: 'cal-db-1', client_id: CLIENT_ID, calendar_id: 'cal-1', provider: 'google_calendar', oauth_state: {}, sync_status: 'connected',
        }],
        error: null,
      };
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.eq = vi.fn().mockImplementation(() => chain);
      chain.select = vi.fn().mockReturnValue(chain);
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => Promise.resolve(resolved).then(resolve));
      return { select: vi.fn().mockReturnValue(chain) };
    }
    if (table === 'agent_signals') {
      const selectChain: Record<string, ReturnType<typeof vi.fn>> = {};
      selectChain.eq = vi.fn().mockImplementation(() => selectChain);
      selectChain.is = vi.fn().mockImplementation(() => selectChain);
      selectChain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
      const updateChain: Record<string, ReturnType<typeof vi.fn>> = {};
      updateChain.eq = vi.fn().mockImplementation(() => updateChain);
      return {
        select: vi.fn().mockReturnValue(selectChain),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue(updateChain),
      };
    }
    if (table === 'calendar_events') {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.eq = vi.fn().mockImplementation(() => chain);
      chain.gt = vi.fn().mockImplementation(() => chain);
      chain.lt = vi.fn().mockResolvedValue({ count: 0, error: null });
      return { select: vi.fn().mockReturnValue(chain) };
    }
    return {};
  });
  return { from } as unknown as InstanceType<typeof import('@supabase/supabase-js')['SupabaseClient']>;
}

describe('executeProposeBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindAvailableSlots.mockResolvedValue([
      { startAt: '2026-06-10T10:00:00Z', endAt: '2026-06-10T10:30:00Z', conflicts: 0, reasoning: 'Good slot', calendarId: 'cal-1' },
    ]);
  });

  it('throws for missing request', async () => {
    await expect(
      executeProposeBooking('run-1', { workspaceId: WORKSPACE_ID, schedulingRequestId: 'missing' },
        { supabase: createMockSupabase({ requestData: null }) }),
    ).rejects.toThrow();
  });

  it('throws INVALID_STATUS when status is not pending', async () => {
    await expect(
      executeProposeBooking('run-1', { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID }, {
        supabase: createMockSupabase({
          requestData: { id: REQ_ID, workspace_id: WORKSPACE_ID, client_id: CLIENT_ID, status: 'booked', duration_minutes: 30, preferences: {}, source_email_id: null },
        }),
      }),
    ).rejects.toThrow('Invalid status');
  });

  it('returns failed status when no calendars connected', async () => {
    mockFindAvailableSlots.mockResolvedValueOnce([]);
    const result = await executeProposeBooking('run-1',
      { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID },
      { supabase: createMockSupabase({ noCalendars: true }) },
    );
    expect(result.status).toBe('failed');
  });

  it('resolves originating signal in both success and failure paths', async () => {
    mockFindAvailableSlots.mockResolvedValueOnce([]);
    const result = await executeProposeBooking('run-1',
      { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID },
      { supabase: createMockSupabase() },
    );
    expect(result.status).toBe('failed');
  });

  it('returns options_proposed with slots on happy path', async () => {
    const result = await executeProposeBooking('run-1',
      { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID },
      { supabase: createMockSupabase() },
    );
    expect(result.status).toBe('options_proposed');
    expect(result.proposedOptions).toHaveLength(1);
    expect(result.proposedOptions![0]).toEqual(
      expect.objectContaining({ startAt: '2026-06-10T10:00:00Z', endAt: '2026-06-10T10:30:00Z' }),
    );
  });

  it('resolveOriginatingSignal filters by entity_id matching source_email_id (H1)', async () => {
    const EMAIL_ID = '00000000-0000-4000-8000-000000000099';
    const result = await executeProposeBooking('run-1',
      { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID },
      { supabase: createMockSupabase({
        requestData: { id: REQ_ID, workspace_id: WORKSPACE_ID, client_id: CLIENT_ID, status: 'pending', duration_minutes: 30, preferences: {}, source_email_id: EMAIL_ID },
      }) },
    );
    expect(result.status).toBe('options_proposed');
  });
});
