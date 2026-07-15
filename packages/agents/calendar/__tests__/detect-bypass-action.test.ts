import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeDetectBypass } from '../detect-bypass-action';
import type { DetectBypassInput } from '../detect-bypass-action';

function createMockSupabase(
  schedulingRequests: Record<string, unknown>[] = [],
  existingMetrics: Record<string, unknown> | null = null,
  metricsError: string | null = null,
) {
  const metricsRow = existingMetrics
    ? {
        id: existingMetrics.id ?? 'm-1',
        total_events: ((existingMetrics.total_events as number) ?? 0) + 1,
        bypass_count: ((existingMetrics.bypass_count as number) ?? 0) + 1,
        bypass_rate: (
          (((existingMetrics.bypass_count as number) ?? 0) + 1) /
          (((existingMetrics.total_events as number) ?? 0) + 1)
        ).toFixed(4),
      }
    : null;

  return {
    from: vi.fn((table: string) => {
      if (table === 'scheduling_requests') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockReturnValue({
                      limit: vi
                        .fn()
                        .mockResolvedValue({ data: schedulingRequests }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'calendar_bypass_metrics') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: existingMetrics,
                      error: metricsError ? { message: metricsError } : null,
                    }),
                  }),
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    error: null,
                    data: metricsRow,
                  }),
                }),
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'agent_signals') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return { select: vi.fn(), insert: vi.fn() };
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeDetectBypass', () => {
  const baseInput: DetectBypassInput = {
    workspaceId: 'ws-1',
    eventId: 'evt-1',
    clientId: 'client-1',
    eventCreatedAt: '2026-05-24T12:00:00Z',
  };

  it('returns not-bypass when matching scheduling request exists', async () => {
    const supabase = createMockSupabase([{ id: 'req-1', status: 'booked' }]);

    const result = await executeDetectBypass('run-1', baseInput, { supabase });

    expect(result.isBypass).toBe(false);
    expect(result.signalEmitted).toBe(false);
  });

  it('detects bypass when no matching scheduling request', async () => {
    const supabase = createMockSupabase([], null);

    const result = await executeDetectBypass('run-1', baseInput, { supabase });

    expect(result.isBypass).toBe(true);
    expect(result.bypassCount).toBe(1);
    expect(result.bypassRate).toBe(1);
  });

  it('updates existing metrics on subsequent bypass', async () => {
    const existingMetrics = {
      id: 'm-1',
      total_events: 3,
      bypass_count: 1,
      bypass_rate: '0.3333',
      window_start: '2026-04-24T00:00:00Z',
      window_end: '2026-05-24T00:00:00Z',
    };
    const supabase = createMockSupabase([], existingMetrics);

    const result = await executeDetectBypass('run-1', baseInput, { supabase });

    expect(result.isBypass).toBe(true);
    expect(result.bypassCount).toBe(2);
    expect(result.totalEvents).toBe(4);
  });

  it('emits signal when bypass rate exceeds threshold', async () => {
    const existingMetrics = {
      id: 'm-1',
      total_events: 2,
      bypass_count: 0,
      bypass_rate: '0.0000',
      window_start: '2026-04-24T00:00:00Z',
      window_end: '2026-05-24T00:00:00Z',
    };
    const supabase = createMockSupabase([], existingMetrics);

    const result = await executeDetectBypass('run-1', baseInput, { supabase });

    expect(result.isBypass).toBe(true);
    expect(result.signalEmitted).toBe(true);
  });
});
