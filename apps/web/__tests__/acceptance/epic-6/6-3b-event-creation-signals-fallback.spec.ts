import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeCreateEvent } from '@flow/agents/calendar/create-event-action';
import { executeProposeBooking } from '@flow/agents/calendar/propose-booking-action';

const {
  mockCreateEvent,
  mockDeleteEvent,
  mockGetCalendarProvider,
  mockCalendarTokenManager,
  mockFindAvailableSlots,
} = vi.hoisted(() => ({
  mockCreateEvent: vi.fn().mockResolvedValue({
    providerEventId: 'evt-provider-1',
    title: 'Meeting with Client',
    description: '',
    startTime: '2026-06-10T10:00:00Z',
    endTime: '2026-06-10T10:30:00Z',
    attendees: [],
  }),
  mockDeleteEvent: vi.fn().mockResolvedValue(undefined),
  mockGetCalendarProvider: vi.fn().mockReturnValue({
    createEvent: vi.fn().mockResolvedValue({
      providerEventId: 'evt-provider-1',
      title: 'Meeting with Client',
      description: '',
      startTime: '2026-06-10T10:00:00Z',
      endTime: '2026-06-10T10:30:00Z',
      attendees: [],
    }),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
    getCalendarId: vi.fn().mockReturnValue('cal-1'),
  }),
  mockCalendarTokenManager: vi.fn().mockImplementation(() => ({
    getValidTokens: vi
      .fn()
      .mockResolvedValue({ tokens: { accessToken: 'test-token' } }),
  })),
  mockFindAvailableSlots: vi.fn().mockResolvedValue([
    {
      startAt: '2026-06-10T10:00:00Z',
      endAt: '2026-06-10T10:30:00Z',
      conflicts: 0,
      reasoning: 'Good slot',
      calendarId: 'cal-1',
    },
  ]),
}));

vi.mock('@flow/db/vault/calendar-tokens', () => ({
  decryptCalendarTokens: vi.fn().mockReturnValue({
    accessToken: 'test-token',
    refreshToken: 'test-refresh',
    expiryDate: Date.now() + 3600000,
    scope: 'https://www.googleapis.com/auth/calendar',
    tokenType: 'Bearer',
  }),
  rotateCalendarTokens: vi.fn().mockReturnValue({ iv: 'mock', data: 'mock' }),
}));

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
  updateRunStatus: vi.fn().mockResolvedValue(undefined),
  requireTenantContext: vi.fn(),
  createFlowError: vi.fn((code: number, type: string, msg: string) => ({
    code,
    type,
    message: msg,
  })),
}));

vi.mock('@flow/agents/calendar/slot-finder', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    findAvailableSlots: (...args: unknown[]) => mockFindAvailableSlots(...args),
  };
});

vi.mock('../../../../../packages/agents/providers/registry', () => ({
  getCalendarProvider: (...args: unknown[]) => mockGetCalendarProvider(...args),
}));

vi.mock(
  '../../../../../packages/agents/providers/google-calendar/token-manager',
  () => ({
    CalendarTokenManager: mockCalendarTokenManager,
  }),
);

vi.mock('@flow/agents/calendar/event-relations', () => ({
  writeRescheduledFromRelation: vi.fn().mockResolvedValue(undefined),
  writeEventRelation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@flow/agents/shared/audit-writer', () => ({
  writeAuditLog: vi.fn(),
}));

import {
  WORKSPACE_ID,
  CLIENT_ID,
  REQ_ID,
  EMAIL_ID,
  CAL_DB_ID,
  createBookingMockSupabase,
} from './_helpers/booking-test-setup';

describe('Story 6-3: Booking Proposals & Event Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateEvent.mockResolvedValue({
      providerEventId: 'evt-provider-1',
      title: 'Meeting with Client',
      description: '',
      startTime: '2026-06-10T10:00:00Z',
      endTime: '2026-06-10T10:30:00Z',
      attendees: [],
    });
    mockGetCalendarProvider.mockReturnValue({
      createEvent: mockCreateEvent,
      deleteEvent: mockDeleteEvent,
      getCalendarId: vi.fn().mockReturnValue('cal-1'),
    });
    mockCalendarTokenManager.mockImplementation(() => ({
      getValidTokens: vi
        .fn()
        .mockResolvedValue({ tokens: { accessToken: 'test-token' } }),
    }));
  });

  describe('[AC4] VA approval to event creation', () => {
    it('calls provider.createEvent, inserts calendar_events, sets booked_event_id and status=booked', async () => {
      const supabase = createBookingMockSupabase({
        requestData: {
          id: REQ_ID,
          workspace_id: WORKSPACE_ID,
          client_id: CLIENT_ID,
          status: 'option_selected',
          proposed_options: [
            {
              startAt: '2026-06-10T10:00:00Z',
              endAt: '2026-06-10T10:30:00Z',
              conflicts: 0,
              reasoning: 'Good slot',
            },
          ],
          selected_option: 0,
          duration_minutes: 30,
          requested_by: { email: 'client@test.com', name: 'Test' },
          source_email_id: null,
          booked_event_id: null,
          request_type: 'book_new',
        },
      });

      const result = await executeCreateEvent(
        'run-1',
        {
          workspaceId: WORKSPACE_ID,
          schedulingRequestId: REQ_ID,
          selectedOptionIndex: 0,
        },
        { supabase },
      );

      expect(result.status).toBe('booked');
      expect(result.eventId).toBe('event-1');
      expect(result.providerEventId).toBe('evt-provider-1');

      expect(mockCreateEvent).toHaveBeenCalledWith(
        'test-token',
        expect.objectContaining({
          calendarId: 'cal-1',
          startTime: '2026-06-10T10:00:00Z',
          endTime: '2026-06-10T10:30:00Z',
        }),
      );

      const eventInsert = supabase._capturedInserts.find(
        (c) => c.table === 'calendar_events',
      );
      expect(eventInsert).toBeDefined();
      expect(eventInsert!.data).toMatchObject({
        workspace_id: WORKSPACE_ID,
        client_calendar_id: CAL_DB_ID,
        client_id: CLIENT_ID,
        provider_event_id: 'evt-provider-1',
        source: 'va_created',
        created_via: 'agent:calendar',
      });

      const reqUpdate = supabase._capturedUpdates.filter(
        (c) => c.table === 'scheduling_requests',
      );
      const bookedUpdate = reqUpdate.find(
        (u) => (u.data as Record<string, unknown>).status === 'booked',
      );
      expect(bookedUpdate).toBeDefined();
      expect(bookedUpdate!.data).toMatchObject({
        booked_event_id: 'event-1',
        status: 'booked',
      });
    });
  });

  describe('[AC7] Signal consumption resolution', () => {
    it('resolves originating signal in both success and failure paths', async () => {
      const supabaseSuccess = createBookingMockSupabase({
        requestData: {
          id: REQ_ID,
          workspace_id: WORKSPACE_ID,
          client_id: CLIENT_ID,
          status: 'pending',
          duration_minutes: 30,
          preferences: {},
          source_email_id: EMAIL_ID,
        },
        signalData: [{ id: 'sig-originating' }],
      });

      await executeProposeBooking(
        'run-1',
        { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID },
        { supabase: supabaseSuccess },
      );

      const signalUpdateOnSuccess = supabaseSuccess._capturedUpdates.find(
        (c) => c.table === 'agent_signals',
      );
      expect(signalUpdateOnSuccess).toBeDefined();
      expect(signalUpdateOnSuccess!.data).toMatchObject({
        resolved_at: expect.any(String),
      });

      mockCreateEvent.mockRejectedValueOnce(new Error('Provider down'));

      const supabaseFailure = createBookingMockSupabase({
        requestData: {
          id: REQ_ID,
          workspace_id: WORKSPACE_ID,
          client_id: CLIENT_ID,
          status: 'option_selected',
          proposed_options: [
            {
              startAt: '2026-06-10T10:00:00Z',
              endAt: '2026-06-10T10:30:00Z',
              conflicts: 0,
              reasoning: 'Slot',
            },
          ],
          selected_option: 0,
          duration_minutes: 30,
          requested_by: { email: 'client@test.com' },
          source_email_id: EMAIL_ID,
          booked_event_id: null,
          request_type: 'book_new',
        },
        signalData: [{ id: 'sig-originating-2' }],
      });

      await expect(
        executeCreateEvent(
          'run-1',
          {
            workspaceId: WORKSPACE_ID,
            schedulingRequestId: REQ_ID,
            selectedOptionIndex: 0,
          },
          { supabase: supabaseFailure },
        ),
      ).rejects.toThrow();

      const signalUpdateOnFailure = supabaseFailure._capturedUpdates.find(
        (c) => c.table === 'agent_signals',
      );
      expect(signalUpdateOnFailure).toBeDefined();
      expect(signalUpdateOnFailure!.data).toMatchObject({
        resolved_at: expect.any(String),
      });
    });
  });

  describe('[AC8] No-availability fallback', () => {
    it('sets status=failed, emits calendar.no_availability, resolves originating signal', async () => {
      mockFindAvailableSlots.mockResolvedValueOnce([]);

      const supabase = createBookingMockSupabase({ noCalendars: true });

      const result = await executeProposeBooking(
        'run-1',
        { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID },
        { supabase },
      );

      expect(result.status).toBe('failed');
      expect(result.proposedOptions).toEqual([]);

      const reqUpdate = supabase._capturedUpdates.find(
        (c) => c.table === 'scheduling_requests',
      );
      expect(reqUpdate).toBeDefined();
      expect(reqUpdate!.data).toMatchObject({ status: 'failed' });

      const signalInsert = supabase._capturedInserts.find(
        (c) => c.table === 'agent_signals',
      );
      expect(signalInsert).toBeDefined();
      expect(signalInsert!.data).toMatchObject({
        agent_id: 'calendar',
        signal_type: 'no_availability',
        workspace_id: WORKSPACE_ID,
        target_agent: 'calendar',
        payload: expect.objectContaining({
          clientId: CLIENT_ID,
          schedulingRequestId: REQ_ID,
        }),
      });
    });
  });
});
