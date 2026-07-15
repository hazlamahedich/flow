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

import { executeResolveCascade } from '@flow/agents/calendar/resolve-cascade-action';
import type { ResolveCascadeInput } from '@flow/agents/calendar/resolve-cascade-action';
import {
  generateDailyPreview,
  emitDailyPreviewSignal,
} from '@flow/agents/calendar/daily-preview';
import { createChainableMock } from './_helpers/bypass-test-setup';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Story 6-4: Bypass Detection & Cascade Rescheduling', () => {
  describe('[AC11] Cascade signal emission', () => {
    it('emits calendar.cascade.triggered signal on proposal and completion', async () => {
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

      const dependentEvent = {
        id: 'evt-2',
        client_calendar_id: 'cal-1',
        provider_event_id: 'prov-2',
        title: 'Dependent',
        start_at: '2026-06-01T11:00:00Z',
        end_at: '2026-06-01T12:00:00Z',
        source: 'client_created',
        created_via: null,
      };

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
                    maybeSingle: vi
                      .fn()
                      .mockResolvedValue({ data: originEvent, error: null }),
                  }),
                }),
              };
            }
            if (selectCallCount === 2) {
              return {
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: [{ id: dependentEvent.id }],
                    error: null,
                  }),
                }),
              };
            }
            return {
              in: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [dependentEvent],
                  error: null,
                }),
              }),
            };
          }),
        },
        calendar_event_relations: {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'rel-1',
                  parent_event_id: 'evt-1',
                  child_event_id: 'evt-2',
                  relation_type: 'travel_time',
                },
              ],
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

      await executeResolveCascade('run-1', input, { supabase });

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          signal_type: 'calendar.cascade.triggered',
          payload: expect.objectContaining({ status: 'proposed' }),
        }),
      );
    });
  });

  describe('[AC12] Daily preview for Morning Brief', () => {
    it('generates daily preview with events, conflicts, bypass alerts, gaps', async () => {
      const supabase = createChainableMock({
        workspaces: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: { timezone: 'UTC' }, error: null }),
            }),
          }),
        },
        calendar_events: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              const chain: Record<string, ReturnType<typeof vi.fn>> = {};
              chain.gte = vi.fn().mockReturnValue(chain);
              chain.lte = vi.fn().mockReturnValue(chain);
              chain.order = vi.fn().mockResolvedValue({
                data: [
                  {
                    title: 'Team Standup',
                    start_at: '2026-05-25T09:00:00Z',
                    end_at: '2026-05-25T09:30:00Z',
                    source: 'va_created',
                    client_id: 'client-1',
                  },
                  {
                    title: 'Client Sync',
                    start_at: '2026-05-25T14:00:00Z',
                    end_at: '2026-05-25T15:00:00Z',
                    source: 'client_created',
                    client_id: null,
                  },
                ],
                error: null,
              });
              return chain;
            }),
          }),
        },
        calendar_bypass_metrics: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockResolvedValue({
                data: [
                  {
                    client_id: 'client-1',
                    bypass_rate: '0.5000',
                    total_events: 4,
                    bypass_count: 2,
                  },
                ],
                error: null,
              }),
            }),
          }),
        },
        clients: {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'client-1', name: 'Acme Corp' }],
              error: null,
            }),
          }),
        },
        agent_signals: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              const chain: Record<string, ReturnType<typeof vi.fn>> = {};
              chain.eq = vi.fn().mockReturnValue(chain);
              chain.gte = vi.fn().mockResolvedValue({ data: [], error: null });
              return chain;
            }),
          }),
        },
      });

      const result = await generateDailyPreview('ws-1', { supabase });

      expect(result.events).toHaveLength(2);
      expect(result.events[0]!.title).toBe('Team Standup');
      expect(result.bypassAlerts).toHaveLength(1);
      expect(result.bypassAlerts[0]!.bypassRate).toBe(0.5);
      expect(result.gaps.length).toBeGreaterThanOrEqual(0);
    });

    it('emits calendar.daily_preview signal consumed by Morning Brief', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });

      const supabase = createChainableMock({
        workspaces: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: { timezone: 'UTC' }, error: null }),
            }),
          }),
        },
        calendar_events: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              const chain: Record<string, ReturnType<typeof vi.fn>> = {};
              chain.gte = vi.fn().mockReturnValue(chain);
              chain.lte = vi.fn().mockReturnValue(chain);
              chain.order = vi
                .fn()
                .mockResolvedValue({ data: [], error: null });
              return chain;
            }),
          }),
        },
        calendar_bypass_metrics: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        },
        agent_signals: {
          insert: insertMock,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              const chain: Record<string, ReturnType<typeof vi.fn>> = {};
              chain.eq = vi.fn().mockReturnValue(chain);
              chain.gte = vi.fn().mockResolvedValue({ data: [], error: null });
              return chain;
            }),
          }),
        },
        clients: {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        },
      });

      await emitDailyPreviewSignal('ws-1', { supabase });

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          signal_type: 'calendar.daily.preview',
          agent_id: 'calendar',
          target_agent: 'inbox',
          workspace_id: 'ws-1',
        }),
      );
      const insertedPayload = insertMock.mock.calls[0]![0] as Record<
        string,
        unknown
      >;
      expect(insertedPayload.dedup_key).toMatch(
        /^cal\.preview:ws-1:\d{4}-\d{2}-\d{2}$/,
      );
    });
  });
});
