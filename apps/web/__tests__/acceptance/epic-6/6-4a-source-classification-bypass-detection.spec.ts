import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { classifyEventSource } from '@flow/agents/calendar/classify-source';
import { executeDetectBypass } from '@flow/agents/calendar/detect-bypass-action';
import type { DetectBypassInput } from '@flow/agents/calendar/detect-bypass-action';
import {
  upsertBypassMetrics,
  getRollingWindow,
} from '@flow/agents/calendar/bypass-metrics';
import { DEFAULT_CALENDAR_CONFIG } from '@flow/agents/calendar/config';
import {
  createChainableMock,
  createBypassMetricsMock,
} from './_helpers/bypass-test-setup';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Story 6-4: Bypass Detection & Cascade Rescheduling', () => {
  describe('[AC1] Source classification', () => {
    const vaEmail = 'va@agency.com';
    const calendars = [{ emailAddress: 'client@example.com' }];

    it('classifies va_created when organizer matches VA email', () => {
      const result = classifyEventSource(
        {
          organizerEmail: 'va@agency.com',
          title: 'Meeting',
          isRecurring: false,
        },
        calendars,
        vaEmail,
      );
      expect(result).toBe('va_created');
    });

    it('classifies client_created when organizer matches client contact', () => {
      const result = classifyEventSource(
        {
          organizerEmail: 'client@example.com',
          title: 'Sync',
          isRecurring: false,
        },
        calendars,
        vaEmail,
      );
      expect(result).toBe('client_created');
    });

    it('classifies third_party for Calendly/Acuity/Zoom patterns', () => {
      expect(
        classifyEventSource(
          {
            organizerEmail: 'user@calendly.com',
            title: 'Booking',
            isRecurring: false,
          },
          calendars,
          vaEmail,
        ),
      ).toBe('third_party');
      expect(
        classifyEventSource(
          {
            organizerEmail: 'test@acuityscheduling.com',
            title: 'Booking',
            isRecurring: false,
          },
          calendars,
          vaEmail,
        ),
      ).toBe('third_party');
      expect(
        classifyEventSource(
          {
            organizerEmail: 'user@zoom.us',
            title: 'Zoom Meeting',
            isRecurring: false,
          },
          calendars,
          vaEmail,
        ),
      ).toBe('third_party');
    });

    it('classifies auto_generated for recurring holiday/OOO', () => {
      expect(
        classifyEventSource(
          { title: 'Public Holiday', isRecurring: true },
          calendars,
          vaEmail,
        ),
      ).toBe('auto_generated');
      expect(
        classifyEventSource(
          { title: 'Out of Office', isRecurring: true },
          calendars,
          vaEmail,
        ),
      ).toBe('auto_generated');
    });

    it('classifies unknown for unrecognized and treats conservatively as client_created', () => {
      const result = classifyEventSource(
        {
          organizerEmail: 'stranger@unknown.org',
          title: 'Mystery Meeting',
          isRecurring: false,
        },
        calendars,
        vaEmail,
      );
      expect(result).toBe('client_created');
    });
  });

  describe('[AC2] Bypass detection trigger', () => {
    const baseInput: DetectBypassInput = {
      workspaceId: 'ws-1',
      eventId: 'evt-1',
      clientId: 'client-1',
      eventCreatedAt: '2026-05-24T12:00:00Z',
    };

    it('flags event as bypass when no matching scheduling request within 24h window', async () => {
      const metricsTableMock = createBypassMetricsMock(null);
      const supabase = createChainableMock({
        scheduling_requests: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({ data: [] }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        },
        calendar_bypass_metrics: metricsTableMock,
        agent_signals: { insert: vi.fn().mockResolvedValue({ error: null }) },
      });

      const result = await executeDetectBypass('run-1', baseInput, {
        supabase,
      });

      expect(result.isBypass).toBe(true);
      expect(result.bypassCount).toBe(1);
      expect(result.bypassRate).toBe(1);
    });

    it('does not flag when matching scheduling request exists', async () => {
      const supabase = createChainableMock({
        scheduling_requests: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({
                        data: [{ id: 'req-1', status: 'booked' }],
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        },
      });

      const result = await executeDetectBypass('run-1', baseInput, {
        supabase,
      });

      expect(result.isBypass).toBe(false);
      expect(result.signalEmitted).toBe(false);
    });
  });

  describe('[AC3] Bypass rate tracking', () => {
    it('upserts into calendar_bypass_metrics with rolling 30-day window', async () => {
      const window = getRollingWindow();
      const startMinus30 = new Date();
      startMinus30.setDate(startMinus30.getDate() - 30);
      expect(new Date(window.start).getTime()).toBeLessThanOrEqual(
        startMinus30.getTime() + 5000,
      );
      expect(new Date(window.end).getTime()).toBeGreaterThanOrEqual(
        Date.now() - 5000,
      );

      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      const supabase = createChainableMock({
        calendar_bypass_metrics: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi
                      .fn()
                      .mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
          upsert: upsertMock,
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        },
      });

      await upsertBypassMetrics({
        supabase,
        workspaceId: 'ws-1',
        clientId: 'client-1',
      });

      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: 'ws-1',
          client_id: 'client-1',
          total_events: 1,
          bypass_count: 1,
        }),
        expect.objectContaining({
          onConflict: 'workspace_id,client_id,window_start',
        }),
      );
    });

    it('increments counters correctly on subsequent bypasses', async () => {
      const existing = {
        id: 'm-1',
        total_events: 3,
        bypass_count: 1,
        bypass_rate: '0.3333',
      };
      const updated = {
        id: 'm-1',
        total_events: 4,
        bypass_count: 2,
        bypass_rate: '0.5000',
      };
      const metricsTableMock = createBypassMetricsMock(existing, updated);

      const supabase = createChainableMock({
        calendar_bypass_metrics: metricsTableMock,
      });

      const result = await upsertBypassMetrics({
        supabase,
        workspaceId: 'ws-1',
        clientId: 'client-1',
      });

      expect(result.bypassCount).toBe(2);
      expect(result.totalEvents).toBe(4);
      expect(result.bypassRate).toBe(0.5);
    });
  });

  describe('[AC4] Bypass threshold alert', () => {
    const baseInput: DetectBypassInput = {
      workspaceId: 'ws-1',
      eventId: 'evt-1',
      clientId: 'client-1',
      eventCreatedAt: '2026-05-24T12:00:00Z',
    };

    it('emits calendar.bypass.detected signal when rate exceeds 0.3', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const existingMetrics = {
        id: 'm-1',
        total_events: 2,
        bypass_count: 0,
        bypass_rate: '0.0000',
      };
      const updatedMetrics = { id: 'm-1', total_events: 3, bypass_count: 1 };
      const metricsTableMock = createBypassMetricsMock(
        existingMetrics,
        updatedMetrics,
      );

      const supabase = createChainableMock({
        scheduling_requests: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({ data: [] }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        },
        calendar_bypass_metrics: metricsTableMock,
        agent_signals: { insert: insertMock },
      });

      const result = await executeDetectBypass('run-1', baseInput, {
        supabase,
      });

      expect(result.signalEmitted).toBe(true);
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          signal_type: 'calendar.bypass.detected',
          agent_id: 'calendar',
          target_agent: 'inbox',
        }),
      );
    });

    it('deduplicates signals daily per client', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const existingMetrics = {
        id: 'm-1',
        total_events: 2,
        bypass_count: 0,
        bypass_rate: '0.0000',
      };
      const updatedMetrics = { id: 'm-1', total_events: 3, bypass_count: 1 };
      const metricsTableMock = createBypassMetricsMock(
        existingMetrics,
        updatedMetrics,
      );

      const supabase = createChainableMock({
        scheduling_requests: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({ data: [] }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        },
        calendar_bypass_metrics: metricsTableMock,
        agent_signals: { insert: insertMock },
      });

      await executeDetectBypass('run-1', baseInput, { supabase });

      const insertedPayload = insertMock.mock.calls[0]![0] as Record<
        string,
        unknown
      >;
      expect(insertedPayload.dedup_key).toMatch(
        /^cal\.bypass:client-1:\d{4}-\d{2}-\d{2}$/,
      );
    });
  });

  describe('[AC5] Bypass signal format', () => {
    it('signal payload includes client_id, bypass_count, bypass_rate, recent_event_id', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const existingMetrics = {
        id: 'm-1',
        total_events: 2,
        bypass_count: 0,
        bypass_rate: '0.0000',
      };
      const updatedMetrics = { id: 'm-1', total_events: 3, bypass_count: 1 };
      const metricsTableMock = createBypassMetricsMock(
        existingMetrics,
        updatedMetrics,
      );

      const supabase = createChainableMock({
        scheduling_requests: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({ data: [] }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        },
        calendar_bypass_metrics: metricsTableMock,
        agent_signals: { insert: insertMock },
      });

      const input: DetectBypassInput = {
        workspaceId: 'ws-1',
        eventId: 'evt-99',
        clientId: 'client-1',
        eventCreatedAt: '2026-05-24T12:00:00Z',
      };

      await executeDetectBypass('run-1', input, { supabase });

      const insertedPayload = insertMock.mock.calls[0]![0] as Record<
        string,
        unknown
      >;
      const payload = insertedPayload.payload as Record<string, unknown>;
      expect(payload).toHaveProperty('client_id', 'client-1');
      expect(payload).toHaveProperty('bypass_count');
      expect(payload).toHaveProperty('bypass_rate');
      expect(payload).toHaveProperty('recent_event_id', 'evt-99');
    });
  });

  describe('[AC6] Config threshold correction', () => {
    it('DEFAULT_CALENDAR_CONFIG.bypassAlertThreshold is 0.3', () => {
      expect(DEFAULT_CALENDAR_CONFIG.bypassAlertThreshold).toBe(0.3);
    });
  });
});
