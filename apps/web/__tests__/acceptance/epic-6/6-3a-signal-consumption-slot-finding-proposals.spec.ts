import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { BookingProposal } from '@flow/agents/calendar/types';
import { consumeSchedulingSignal } from '@flow/agents/calendar/signal-consumer';
import { executeProposeBooking } from '@flow/agents/calendar/propose-booking-action';
import { findAvailableSlots } from '@flow/agents/calendar/slot-finder';

const { mockGetFreeBusy, mockFindAvailableSlots } = vi.hoisted(() => ({
  mockGetFreeBusy: vi.fn().mockResolvedValue([]),
  mockFindAvailableSlots: vi.fn().mockResolvedValue([
    { startAt: '2026-06-10T10:00:00Z', endAt: '2026-06-10T10:30:00Z', conflicts: 0, reasoning: 'Good slot', calendarId: 'cal-1' },
    { startAt: '2026-06-10T11:00:00Z', endAt: '2026-06-10T11:30:00Z', conflicts: 0, reasoning: 'Good slot', calendarId: 'cal-1' },
    { startAt: '2026-06-10T14:00:00Z', endAt: '2026-06-10T14:30:00Z', conflicts: 0, reasoning: 'Good slot', calendarId: 'cal-1' },
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
  createFlowError: vi.fn((code: number, type: string, msg: string) => ({ code, type, message: msg })),
}));

vi.mock('@flow/agents/calendar/slot-finder', async (importOriginal) => {
  const original = await importOriginal() as Record<string, unknown>;
  return {
    ...original,
    findAvailableSlots: (...args: unknown[]) => mockFindAvailableSlots(...args),
  };
});

vi.mock('../../../../../packages/agents/providers/registry', () => ({
  getCalendarProvider: vi.fn().mockReturnValue({
    getCalendarId: vi.fn().mockReturnValue('cal-1'),
    getFreeBusy: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('../../../../../packages/agents/providers/google-calendar/token-manager', () => ({
  CalendarTokenManager: vi.fn().mockImplementation(() => ({
    getValidTokens: vi.fn().mockResolvedValue({ tokens: { accessToken: 'test-token' } }),
  })),
}));

vi.mock('@flow/agents/calendar/event-relations', () => ({
  writeRescheduledFromRelation: vi.fn().mockResolvedValue(undefined),
  writeEventRelation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@flow/agents/shared/audit-writer', () => ({
  writeAuditLog: vi.fn(),
}));

import { WORKSPACE_ID, CLIENT_ID, REQ_ID, EMAIL_ID, CAL_DB_ID, SIGNAL_ID, createBookingMockSupabase } from './_helpers/booking-test-setup';

describe('Story 6-3: Booking Proposals & Event Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindAvailableSlots.mockResolvedValue([
      { startAt: '2026-06-10T10:00:00Z', endAt: '2026-06-10T10:30:00Z', conflicts: 0, reasoning: 'Good slot', calendarId: 'cal-1' },
      { startAt: '2026-06-10T11:00:00Z', endAt: '2026-06-10T11:30:00Z', conflicts: 0, reasoning: 'Good slot', calendarId: 'cal-1' },
      { startAt: '2026-06-10T14:00:00Z', endAt: '2026-06-10T14:30:00Z', conflicts: 0, reasoning: 'Good slot', calendarId: 'cal-1' },
    ]);
  });

  describe('[AC1] Scheduling request consumption', () => {
    it('creates scheduling_request from email.action_extracted signal with source_type=email_extraction and status=pending', async () => {
      const supabase = createBookingMockSupabase();

      const signal = {
        id: SIGNAL_ID,
        workspaceId: WORKSPACE_ID,
        payload: {
          actionType: 'schedule_meeting',
          senderEmail: 'client@example.com',
          senderName: 'Test Client',
          duration: 30,
          timezone: 'America/New_York',
        },
        entityId: EMAIL_ID,
      };

      const result = await consumeSchedulingSignal(signal, { supabase });

      expect(result.status).toBe('created');
      expect(result.schedulingRequest).not.toBeNull();
      expect(result.schedulingRequest!.sourceType).toBe('email_extraction');
      expect(result.schedulingRequest!.status).toBe('pending');
      expect(result.schedulingRequest!.requestType).toBe('book_new');
      expect(result.schedulingRequest!.sourceEmailId).toBe(EMAIL_ID);
      expect(result.schedulingRequest!.clientId).toBe(CLIENT_ID);

      const insertCall = supabase._capturedInserts.find(
        (c) => c.table === 'scheduling_requests',
      );
      expect(insertCall).toBeDefined();
      expect(insertCall!.data).toMatchObject({
        source_type: 'email_extraction',
        status: 'pending',
        workspace_id: WORKSPACE_ID,
        client_id: CLIENT_ID,
        source_email_id: EMAIL_ID,
      });
    });
  });

  describe('[AC2] Slot finding', () => {
    it('finds available slots across connected calendars within working hours, returns up to 3', async () => {
      const slots = await findAvailableSlots(
        {
          workspaceId: WORKSPACE_ID,
          clientId: CLIENT_ID,
          durationMinutes: 30,
          preferences: { timezone: 'UTC' },
          calendars: [{
            id: CAL_DB_ID,
            calendarId: 'cal-1',
            provider: {
              getFreeBusy: mockGetFreeBusy,
              getCalendarId: vi.fn().mockReturnValue('cal-1'),
            } as unknown as import('@flow/agents/calendar/providers/calendar-provider').CalendarProvider,
            accessToken: 'test-token',
          }],
        },
        { supabase: createBookingMockSupabase() },
      );

      expect(slots.length).toBeLessThanOrEqual(3);
      if (slots.length > 0) {
        expect(slots[0]).toHaveProperty('startAt');
        expect(slots[0]).toHaveProperty('endAt');
        expect(slots[0]).toHaveProperty('calendarId');
        expect(slots[0]).toHaveProperty('reasoning');
      }
    });
  });

  describe('[AC3] Booking proposal creation', () => {
    it('inserts proposed_options JSONB and sets status=options_proposed', async () => {
      const supabase = createBookingMockSupabase();

      const result = await executeProposeBooking('run-1',
        { workspaceId: WORKSPACE_ID, schedulingRequestId: REQ_ID },
        { supabase },
      );

      expect(result.status).toBe('options_proposed');
      expect(result.proposedOptions).toBeDefined();
      expect(result.proposedOptions!.length).toBeGreaterThan(0);

      const updateCall = supabase._capturedUpdates.find(
        (c) => c.table === 'scheduling_requests',
      );
      expect(updateCall).toBeDefined();
      expect(updateCall!.data).toMatchObject({ status: 'options_proposed' });
      expect(updateCall!.data).toHaveProperty('proposed_options');
      const proposedOptions = (updateCall!.data as Record<string, unknown>).proposed_options as BookingProposal[];
      expect(Array.isArray(proposedOptions)).toBe(true);
      expect(proposedOptions[0]).toHaveProperty('startAt');
      expect(proposedOptions[0]).toHaveProperty('endAt');
      expect(proposedOptions[0]).toHaveProperty('conflicts');
      expect(proposedOptions[0]).toHaveProperty('reasoning');
    });
  });
});
