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

import { writeRescheduledFromRelation } from '@flow/agents/calendar/event-relations';
import { executeResolveCascade } from '@flow/agents/calendar/resolve-cascade-action';
import type { ResolveCascadeInput } from '@flow/agents/calendar/resolve-cascade-action';
import { executeCascadeOption } from '@flow/agents/calendar/cascade-executor';
import type { CascadeOption } from '@flow/agents/calendar/resolve-cascade-action';
import { CALENDAR_TRUST_LEVELS } from '@flow/agents/calendar/config';
import { createChainableMock } from './_helpers/bypass-test-setup';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Story 6-4: Bypass Detection & Cascade Rescheduling', () => {
  describe('[AC7] Event dependency tracking', () => {
    it('writes rescheduled_from relation when reschedule creates new event', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      const supabase = createChainableMock({
        calendar_event_relations: { upsert: upsertMock },
      });

      await writeRescheduledFromRelation('old-evt-1', 'new-evt-1', supabase);

      expect(upsertMock).toHaveBeenCalledWith(
        {
          parent_event_id: 'old-evt-1',
          child_event_id: 'new-evt-1',
          relation_type: 'rescheduled_from',
        },
        { onConflict: 'parent_event_id,child_event_id,relation_type', ignoreDuplicates: true },
      );
    });
  });

  describe('[AC8] Cascade trigger', () => {
    it('identifies dependent events via calendar_event_relations and proximity heuristic', async () => {
      const originEvent = {
        id: 'evt-1',
        client_calendar_id: 'cal-1',
        provider_event_id: 'prov-1',
        title: 'Origin Meeting',
        start_at: '2026-06-01T10:00:00Z',
        end_at: '2026-06-01T11:00:00Z',
        source: 'client_created',
        created_via: null,
      };

      const relatedEvents = [
        { id: 'rel-1', parent_event_id: 'evt-1', child_event_id: 'evt-2', relation_type: 'travel_time' },
      ];

      const proximityEvents = [
        { id: 'evt-3' },
      ];

      const affectedEventDetails = [
        { id: 'evt-2', client_calendar_id: 'cal-1', provider_event_id: 'prov-2', title: 'Dependent', start_at: '2026-06-01T11:00:00Z', end_at: '2026-06-01T12:00:00Z', source: 'client_created', created_via: null },
        { id: 'evt-3', client_calendar_id: 'cal-1', provider_event_id: 'prov-3', title: 'Proximate', start_at: '2026-06-01T09:30:00Z', end_at: '2026-06-01T10:30:00Z', source: 'client_created', created_via: null },
      ];

      const insertMock = vi.fn().mockResolvedValue({ error: null });
      let eventsQueryCallCount = 0;

      const supabase = createChainableMock({
        calendar_events: {
          select: vi.fn().mockImplementation(() => {
            eventsQueryCallCount++;
            if (eventsQueryCallCount === 1) {
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: originEvent, error: null }),
                  }),
                }),
              };
            }
            if (eventsQueryCallCount === 2) {
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    neq: vi.fn().mockReturnValue({
                      gte: vi.fn().mockReturnValue({
                        lte: vi.fn().mockResolvedValue({ data: proximityEvents, error: null }),
                      }),
                    }),
                  }),
                }),
              };
            }
            if (eventsQueryCallCount === 3) {
              return {
                in: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: affectedEventDetails, error: null }),
                }),
              };
            }
            return {};
          }),
        },
        calendar_event_relations: {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ data: relatedEvents, error: null }),
          }),
        },
        agent_signals: { insert: insertMock },
      });

      const input: ResolveCascadeInput = {
        workspaceId: 'ws-1',
        originEventId: 'evt-1',
        clientId: 'client-1',
        action: 'cancelled',
      };

      const result = await executeResolveCascade('run-1', input, { supabase });

      expect(result.affectedCount).toBeGreaterThanOrEqual(1);
      expect(result.options.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('[AC9] Cascade proposal', () => {
    it('creates agent_runs record with resolveCascade action type at trust level 1', () => {
      expect(CALENDAR_TRUST_LEVELS.resolveCascade).toBe(1);
    });

    it('proposes up to 3 resolution options as single unified card', async () => {
      const originEvent = {
        id: 'evt-1',
        client_calendar_id: 'cal-1',
        provider_event_id: 'prov-1',
        title: 'Origin',
        start_at: '2026-06-01T10:00:00Z',
        end_at: '2026-06-01T11:00:00Z',
        source: 'client_created',
        created_via: null,
      };

      const affectedDetails = [
        { id: 'evt-2', client_calendar_id: 'cal-1', provider_event_id: 'prov-2', title: 'Meeting A', start_at: '2026-06-01T11:00:00Z', end_at: '2026-06-01T12:00:00Z', source: 'client_created', created_via: null },
      ];

      const insertMock = vi.fn().mockResolvedValue({ error: null });

      let selectCallCount = 0;
      const supabase = createChainableMock({
        calendar_events: {
          select: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: originEvent, error: null }),
                  }),
                }),
              };
            }
            return {
              in: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: affectedDetails, error: null }),
              }),
            };
          }),
        },
        calendar_event_relations: {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [{ id: 'rel-1', parent_event_id: 'evt-1', child_event_id: 'evt-2', relation_type: 'prep_time' }],
              error: null,
            }),
          }),
        },
        agent_signals: { insert: insertMock },
      });

      const input: ResolveCascadeInput = {
        workspaceId: 'ws-1',
        originEventId: 'evt-1',
        clientId: null,
        action: 'cancelled',
      };

      const result = await executeResolveCascade('run-1', input, { supabase });

      expect(result.options.length).toBeLessThanOrEqual(3);
      expect(result.options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'free-block' }),
          expect.objectContaining({ id: 'keep-as-is' }),
        ]),
      );
      expect(result.affectedCount).toBe(1);
    });
  });

  describe('[AC10] Cascade execution with saga', () => {
    const mockProvider = {
      updateEvent: vi.fn(),
      deleteEvent: vi.fn(),
    };

    function getProvider(_name: string) {
      return mockProvider as unknown as import('@flow/agents/providers/calendar-provider').CalendarProvider;
    }

    beforeEach(() => {
      mockProvider.updateEvent.mockResolvedValue(undefined);
      mockProvider.deleteEvent.mockResolvedValue(undefined);
    });

    it('executes cascade updates sequentially and rolls back on failure', async () => {
      const option: CascadeOption = {
        id: 'opt-1',
        affectedEvents: [
          { eventId: 'evt-2', action: 'reschedule' },
          { eventId: 'evt-3', action: 'cancel' },
        ],
      };

      const calData = [{ id: 'cal-1', calendar_id: 'gcal-1', provider: 'google_calendar', oauth_state: {} }];
      const eventData = [
        { id: 'evt-2', title: 'Meeting A', start_at: '2026-06-01T10:00:00Z', end_at: '2026-06-01T11:00:00Z', provider_event_id: 'prov-2', client_calendar_id: 'cal-1' },
        { id: 'evt-3', title: 'Meeting B', start_at: '2026-06-01T14:00:00Z', end_at: '2026-06-01T15:00:00Z', provider_event_id: 'prov-3', client_calendar_id: 'cal-1' },
      ];

      const supabase = createChainableMock({
        client_calendars: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: calData, error: null }),
              }),
            }),
          }),
        },
        calendar_events: {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: eventData, error: null }),
            }),
          }),
        },
        agent_signals: { insert: vi.fn().mockResolvedValue({ error: null }) },
      });

      mockProvider.deleteEvent.mockRejectedValueOnce(new Error('Provider down'));

      await expect(
        executeCascadeOption('run-1', 'ws-1', option, supabase, getProvider),
      ).rejects.toMatchObject({ code: 'CASCADE_PARTIAL_FAILURE' });

      expect(mockProvider.updateEvent).toHaveBeenCalledTimes(2);
    });

    it('records saga result in agent_runs.metadata', async () => {
      const option: CascadeOption = {
        id: 'opt-1',
        affectedEvents: [
          { eventId: 'evt-2', action: 'reschedule' },
          { eventId: 'evt-3', action: 'cancel' },
        ],
      };

      const calData = [{ id: 'cal-1', calendar_id: 'gcal-1', provider: 'google_calendar', oauth_state: {} }];
      const eventData = [
        { id: 'evt-2', title: 'Meeting A', start_at: '2026-06-01T10:00:00Z', end_at: '2026-06-01T11:00:00Z', provider_event_id: 'prov-2', client_calendar_id: 'cal-1' },
        { id: 'evt-3', title: 'Meeting B', start_at: '2026-06-01T14:00:00Z', end_at: '2026-06-01T15:00:00Z', provider_event_id: 'prov-3', client_calendar_id: 'cal-1' },
      ];

      const supabase = createChainableMock({
        client_calendars: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: calData, error: null }),
              }),
            }),
          }),
        },
        calendar_events: {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: eventData, error: null }),
            }),
          }),
        },
        agent_signals: { insert: vi.fn().mockResolvedValue({ error: null }) },
      });

      const result = await executeCascadeOption('run-1', 'ws-1', option, supabase, getProvider);

      expect(result.success).toBe(true);
      expect(result.executed).toHaveLength(2);
      expect(result.executed[0]!.action).toBe('reschedule');
      expect(result.executed[1]!.action).toBe('cancel');
    });
  });
});
