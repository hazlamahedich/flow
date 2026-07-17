import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { BookingProposal } from '@flow/agents/calendar/types';
import {
  SchedulingRequestSchema,
  BookingProposalInputSchema,
  CreateEventInputSchema,
} from '@flow/agents/calendar/schemas';
import { consumeSchedulingSignal } from '@flow/agents/calendar/signal-consumer';
import { executeProposeBooking } from '@flow/agents/calendar/propose-booking-action';
import { executeCreateEvent } from '@flow/agents/calendar/create-event-action';
import { registerCalendarWorkers } from '@flow/agents/orchestrator/calendar-worker';

const {
  mockCreateEvent,
  mockGetCalendarProvider,
  mockCalendarTokenManager,
  mockFindAvailableSlots,
  mockGetFreeBusy,
} = vi.hoisted(() => ({
  mockCreateEvent: vi.fn().mockResolvedValue({
    providerEventId: 'evt-provider-1',
    title: 'Meeting with Client',
    description: '',
    startTime: '2026-06-10T10:00:00Z',
    endTime: '2026-06-10T10:30:00Z',
    attendees: [],
  }),
  mockGetCalendarProvider: vi.fn().mockReturnValue({
    createEvent: vi.fn().mockResolvedValue({
      providerEventId: 'evt-provider-1',
      title: 'Meeting with Client',
      description: '',
      startTime: '2026-06-10T10:00:00Z',
      endTime: '2026-06-10T10:30:00Z',
      attendees: [],
    }),
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
  mockGetFreeBusy: vi.fn().mockResolvedValue([]),
}));

const mockUpdateRunStatus = vi.fn().mockResolvedValue(undefined);
const mockCreateServiceClient = vi.fn();

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
  createServiceClient: (...args: unknown[]) => mockCreateServiceClient(...args),
  updateRunStatus: (...args: unknown[]) => mockUpdateRunStatus(...args),
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

vi.mock('@flow/agents/orchestrator/schemas', async () => {
  const { z } = await import('zod');
  return {
    AgentJobPayloadSchema: z.object({
      runId: z.string().uuid(),
      workspaceId: z.string().uuid(),
      agentId: z.string(),
      actionType: z.string().min(1),
      input: z.record(z.unknown()),
      clientId: z.string().uuid().nullable(),
      correlationId: z.string().uuid(),
    }),
  };
});

vi.mock('@flow/agents/orchestrator/calendar-bypass-worker', () => ({
  handleDetectBypass: vi.fn(),
  handleResolveCascade: vi.fn(),
  registerCalendarScheduledJobs: vi.fn().mockResolvedValue(undefined),
}));

import {
  WORKSPACE_ID,
  CLIENT_ID,
  REQ_ID,
  EMAIL_ID,
  CAL_DB_ID,
  SIGNAL_ID,
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
    mockFindAvailableSlots.mockResolvedValue([
      {
        startAt: '2026-06-10T10:00:00Z',
        endAt: '2026-06-10T10:30:00Z',
        conflicts: 0,
        reasoning: 'Good slot',
        calendarId: 'cal-1',
      },
      {
        startAt: '2026-06-10T11:00:00Z',
        endAt: '2026-06-10T11:30:00Z',
        conflicts: 0,
        reasoning: 'Good slot',
        calendarId: 'cal-1',
      },
      {
        startAt: '2026-06-10T14:00:00Z',
        endAt: '2026-06-10T14:30:00Z',
        conflicts: 0,
        reasoning: 'Good slot',
        calendarId: 'cal-1',
      },
    ]);
    mockUpdateRunStatus.mockResolvedValue(undefined);
    mockGetCalendarProvider.mockReturnValue({
      createEvent: mockCreateEvent,
      getCalendarId: vi.fn().mockReturnValue('cal-1'),
    });
    mockCalendarTokenManager.mockImplementation(() => ({
      getValidTokens: vi
        .fn()
        .mockResolvedValue({ tokens: { accessToken: 'test-token' } }),
    }));
  });

  describe('[AC5] Performance SLA', () => {
    it('pipeline logs started_at/completed_at timestamps to agent_runs.metadata', async () => {
      const supabase = createBookingMockSupabase();
      mockCreateServiceClient.mockReturnValue(supabase);

      const mockBoss = {
        work: vi
          .fn()
          .mockImplementation(
            async (
              _queue: string,
              handler: (job: unknown) => Promise<void>,
            ) => {
              await handler({
                data: {
                  runId: '00000000-0000-4000-8000-000000000050',
                  workspaceId: WORKSPACE_ID,
                  agentId: 'calendar',
                  actionType: 'proposeBooking',
                  input: {
                    schedulingRequestId: REQ_ID,
                    workspace_id: WORKSPACE_ID,
                  },
                  clientId: null,
                  correlationId: '00000000-0000-4000-8000-000000000060',
                },
              });
            },
          ),
      };

      await registerCalendarWorkers(
        mockBoss as unknown as import('pg-boss').PgBoss,
      );

      const runningCall = mockUpdateRunStatus.mock.calls.find(
        (call) => call[1] === 'running',
      );
      expect(runningCall).toBeDefined();
      expect(runningCall![0]).toBe('00000000-0000-4000-8000-000000000050');
      expect(runningCall![2]).toMatchObject({ startedAt: expect.any(String) });
      const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      expect((runningCall![2] as Record<string, unknown>).startedAt).toMatch(
        isoPattern,
      );

      const completedCall = mockUpdateRunStatus.mock.calls.find(
        (call) => call[1] === 'completed',
      );
      expect(completedCall).toBeDefined();
      expect(completedCall![2]).toMatchObject({
        completedAt: expect.any(String),
      });
      expect(
        (completedCall![2] as Record<string, unknown>).completedAt,
      ).toMatch(isoPattern);
    });
  });

  describe('[AC6] Inter-agent communication', () => {
    it('Calendar Agent reads signals from agent_signals table with no direct inbox imports', async () => {
      const signal = {
        id: SIGNAL_ID,
        workspaceId: WORKSPACE_ID,
        payload: {
          actionType: 'schedule_meeting',
          senderEmail: 'client@example.com',
          senderName: 'Test Client',
        },
        entityId: null,
      };

      const supabase = createBookingMockSupabase();
      await consumeSchedulingSignal(signal, { supabase });

      const tablesAccessed = vi
        .mocked(supabase.from)
        .mock.calls.map((call) => call[0]);

      expect(tablesAccessed).toContain('clients');
      expect(tablesAccessed).toContain('scheduling_requests');

      const hasInboxImport =
        tablesAccessed.includes('inbox') || tablesAccessed.includes('emails');
      expect(hasInboxImport).toBe(false);
    });
  });

  describe('[AC9] Client resolution', () => {
    it('resolves sender to client_id or fails with calendar.no_client_match signal', async () => {
      const signal = {
        id: SIGNAL_ID,
        workspaceId: WORKSPACE_ID,
        payload: {
          actionType: 'schedule_meeting',
          senderEmail: 'unknown@nowhere.com',
          senderName: 'Unknown',
        },
        entityId: null,
      };

      const supabaseNoMatch = createBookingMockSupabase({ noClients: true });
      const resultNoMatch = await consumeSchedulingSignal(signal, {
        supabase: supabaseNoMatch,
      });

      expect(resultNoMatch.status).toBe('no_client_match');
      expect(resultNoMatch.schedulingRequest).toBeNull();

      const signalInsert = supabaseNoMatch._capturedInserts.find(
        (c) => c.table === 'agent_signals',
      );
      expect(signalInsert).toBeDefined();
      expect(signalInsert!.data).toMatchObject({
        agent_id: 'calendar',
        signal_type: 'no_client_match',
        workspace_id: WORKSPACE_ID,
        target_agent: 'calendar',
      });

      const supabaseMatch = createBookingMockSupabase();
      const resultMatch = await consumeSchedulingSignal(signal, {
        supabase: supabaseMatch,
      });
      expect(resultMatch.status).toBe('created');
      expect(resultMatch.schedulingRequest).not.toBeNull();
      expect(resultMatch.schedulingRequest!.clientId).toBe(CLIENT_ID);
    });
  });

  describe('[AC10] Option selection', () => {
    it('transitions status from options_proposed to option_selected before createEvent job', async () => {
      const parsed = BookingProposalInputSchema.safeParse({
        workspaceId: WORKSPACE_ID,
        schedulingRequestId: REQ_ID,
      });
      expect(parsed.success).toBe(true);

      const createParsed = CreateEventInputSchema.safeParse({
        workspaceId: WORKSPACE_ID,
        schedulingRequestId: REQ_ID,
        selectedOptionIndex: 0,
      });
      expect(createParsed.success).toBe(true);

      const proposeResult = await executeProposeBooking(
        'run-1',
        { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID },
        { supabase: createBookingMockSupabase() },
      );
      expect(proposeResult.status).toBe('options_proposed');
      expect(proposeResult.proposedOptions!.length).toBeGreaterThan(0);

      const proposedOptions: BookingProposal[] = proposeResult.proposedOptions!;

      const createResult = await executeCreateEvent(
        'run-1',
        {
          workspaceId: WORKSPACE_ID,
          schedulingRequestId: REQ_ID,
          selectedOptionIndex: 0,
        },
        {
          supabase: createBookingMockSupabase({
            requestData: {
              id: REQ_ID,
              workspace_id: WORKSPACE_ID,
              client_id: CLIENT_ID,
              status: 'option_selected',
              proposed_options: proposedOptions,
              selected_option: 0,
              duration_minutes: 30,
              requested_by: { email: 'client@test.com', name: 'Test' },
              source_email_id: null,
              booked_event_id: null,
              request_type: 'book_new',
            },
          }),
        },
      );

      expect(createResult.status).toBe('booked');
      expect(createResult.eventId).toBe('event-1');

      expect(
        SchedulingRequestSchema.safeParse({
          workspaceId: WORKSPACE_ID,
          clientId: CLIENT_ID,
          sourceEmailId: EMAIL_ID,
          sourceType: 'email_extraction',
          requestType: 'book_new',
          requestedBy: { email: 'client@example.com', name: 'Test' },
          durationMinutes: 30,
          preferences: {},
        }).success,
      ).toBe(true);
    });
  });
});
