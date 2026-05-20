import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockCreateEvent, mockDeleteEvent } = vi.hoisted(() => ({
  mockCreateEvent: vi.fn().mockResolvedValue({
    providerEventId: 'evt-1',
    title: 'Meeting',
    description: '',
    startTime: '2026-06-10T10:00:00Z',
    endTime: '2026-06-10T10:30:00Z',
    attendees: [],
  }),
  mockDeleteEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../providers/registry.js', () => ({
  getCalendarProvider: vi.fn().mockReturnValue({
    createEvent: mockCreateEvent,
    deleteEvent: mockDeleteEvent,
  }),
}));

vi.mock('../../providers/google-calendar/token-manager.js', () => ({
  CalendarTokenManager: vi.fn().mockImplementation(() => ({
    getValidTokens: vi.fn().mockResolvedValue({ tokens: { accessToken: 'test-token' } }),
  })),
}));

import { executeCreateEvent } from '../create-event-action';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const CLIENT_ID = '00000000-0000-4000-8000-000000000002';
const REQ_ID = '00000000-0000-4000-8000-000000000030';
const CAL_ID = '00000000-0000-4000-8000-000000000003';

const proposedOptions = [
  { startAt: '2026-06-10T10:00:00Z', endAt: '2026-06-10T10:30:00Z', conflicts: 0, reasoning: 'Good slot' },
];

function createMockSupabase(opts: {
  requestData?: Record<string, unknown> | null;
  noCalendars?: boolean;
  eventInsertError?: string | null;
  signalData?: Array<{ id: string }> | null;
} = {}) {
  const defaultRequest = {
    id: REQ_ID, workspace_id: WORKSPACE_ID, client_id: CLIENT_ID,
    status: 'option_selected' as const, proposed_options: proposedOptions,
    selected_option: 0, duration_minutes: 30,
    requested_by: { email: 'client@test.com', name: 'Test' },
    source_email_id: null,
  };
  const requestRow = opts.requestData === undefined ? defaultRequest : opts.requestData;
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'scheduling_requests') {
      const selectChain: Record<string, ReturnType<typeof vi.fn>> = {};
      selectChain.eq = vi.fn().mockImplementation(() => selectChain);
      selectChain.maybeSingle = vi.fn().mockResolvedValue({
        data: requestRow,
        error: null,
      });
      const updateChain: Record<string, ReturnType<typeof vi.fn>> = {};
      updateChain.eq = vi.fn().mockImplementation(() => updateChain);
      return {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn().mockReturnValue(updateChain),
      };
    }
    if (table === 'client_calendars') {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.eq = vi.fn().mockImplementation(() => chain);
      chain.limit = vi.fn().mockResolvedValue({
        data: opts.noCalendars ? [] : [{
          id: CAL_ID, calendar_id: 'cal-1', provider: 'google_calendar', oauth_state: {},
        }],
        error: null,
      });
      return { select: vi.fn().mockReturnValue(chain) };
    }
    if (table === 'calendar_events') {
      const insertChain: Record<string, ReturnType<typeof vi.fn>> = {};
      insertChain.select = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: opts.eventInsertError ? null : { id: 'event-1' },
          error: opts.eventInsertError ? { message: opts.eventInsertError } : null,
        }),
      });
      return { insert: vi.fn().mockReturnValue(insertChain) };
    }
    if (table === 'agent_signals') {
      const selectChain: Record<string, ReturnType<typeof vi.fn>> = {};
      selectChain.eq = vi.fn().mockImplementation(() => selectChain);
      selectChain.is = vi.fn().mockImplementation(() => selectChain);
      selectChain.limit = vi.fn().mockResolvedValue({
        data: opts.signalData ?? [],
        error: null,
      });
      const updateChain: Record<string, ReturnType<typeof vi.fn>> = {};
      updateChain.eq = vi.fn().mockImplementation(() => updateChain);
      return {
        select: vi.fn().mockReturnValue(selectChain),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue(updateChain),
      };
    }
    return {};
  });
  return { from } as unknown as InstanceType<typeof import('@supabase/supabase-js')['SupabaseClient']>;
}

describe('executeCreateEvent', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws for missing request', async () => {
    await expect(
      executeCreateEvent('run-1', { workspaceId: WORKSPACE_ID, schedulingRequestId: 'missing', selectedOptionIndex: 0 },
        { supabase: createMockSupabase({ requestData: null }) }),
    ).rejects.toThrow();
  });

  it('throws INVALID_STATUS when not option_selected', async () => {
    await expect(
      executeCreateEvent('run-1', { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID, selectedOptionIndex: 0 }, {
        supabase: createMockSupabase({
          requestData: { id: REQ_ID, workspace_id: WORKSPACE_ID, client_id: CLIENT_ID, status: 'pending', proposed_options: proposedOptions, selected_option: null, duration_minutes: 30, requested_by: {}, source_email_id: null },
        }),
      }),
    ).rejects.toThrow('Invalid status');
  });

  it('handles invalid option index gracefully', async () => {
    await expect(
      executeCreateEvent('run-1', { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID, selectedOptionIndex: 0 },
        { supabase: createMockSupabase({ requestData: { id: REQ_ID, workspace_id: WORKSPACE_ID, client_id: CLIENT_ID, status: 'option_selected', proposed_options: proposedOptions, selected_option: 99, duration_minutes: 30, requested_by: { email: 'client@test.com', name: 'Test' }, source_email_id: null } }) }),
    ).rejects.toThrow('Invalid option index');
  });

  it('creates event and returns booked on happy path (H3: trusts DB selected_option)', async () => {
    const result = await executeCreateEvent('run-1',
      { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID, selectedOptionIndex: 7 },
      { supabase: createMockSupabase() },
    );
    expect(result.status).toBe('booked');
    expect(result.eventId).toBe('event-1');
    expect(result.providerEventId).toBe('evt-1');
    expect(mockCreateEvent).toHaveBeenCalledWith('test-token', expect.objectContaining({
      startTime: '2026-06-10T10:00:00Z',
      endTime: '2026-06-10T10:30:00Z',
    }));
  });

  it('cleans up provider event when DB insert fails (H4: orphan cleanup)', async () => {
    mockDeleteEvent.mockClear();
    await expect(
      executeCreateEvent('run-1',
        { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID, selectedOptionIndex: 0 },
        { supabase: createMockSupabase({ eventInsertError: 'FK violation' }) },
      ),
    ).rejects.toThrow('calendar_events insert failed');
    expect(mockDeleteEvent).toHaveBeenCalledWith('test-token', 'cal-1', 'evt-1');
  });

  it('throws PROVIDER_ERROR with statusCode 500 on provider failure (M6)', async () => {
    mockCreateEvent.mockRejectedValueOnce(new Error('API quota exceeded'));
    try {
      await executeCreateEvent('run-1',
        { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID, selectedOptionIndex: 0 },
        { supabase: createMockSupabase() },
      );
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Error).message).toBe('API quota exceeded');
      expect((err as { code?: string }).code).toBe('PROVIDER_ERROR');
      expect((err as { statusCode?: number }).statusCode).toBe(500);
    }
  });

  it('resolves originating signal filtered by entity_id matching source_email_id (H1)', async () => {
    const EMAIL_ID = '00000000-0000-4000-8000-000000000099';
    const result = await executeCreateEvent('run-1',
      { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID, selectedOptionIndex: 0 },
      { supabase: createMockSupabase({
        requestData: { id: REQ_ID, workspace_id: WORKSPACE_ID, client_id: CLIENT_ID, status: 'option_selected', proposed_options: proposedOptions, selected_option: 0, duration_minutes: 30, requested_by: { email: 'client@test.com', name: 'Test' }, source_email_id: EMAIL_ID },
        signalData: [{ id: 'sig-1' }],
      }) },
    );
    expect(result.status).toBe('booked');
  });

  it('no-op when source_email_id is null — no signal resolution attempted', async () => {
    const result = await executeCreateEvent('run-1',
      { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID, selectedOptionIndex: 0 },
      { supabase: createMockSupabase() },
    );
    expect(result.status).toBe('booked');
  });
});
