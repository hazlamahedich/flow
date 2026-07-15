import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRollingWindow,
  upsertBypassMetrics,
  incrementTotalEvents,
  getBypassMetricsForClient,
} from '../bypass-metrics';

function createMetricsSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return chain;
}

function createMetricsUpdateChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getRollingWindow', () => {
  it('returns start 30 days before end', () => {
    const { start, end } = getRollingWindow();
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffDays =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(30);
  });

  it('returns valid ISO strings', () => {
    const { start, end } = getRollingWindow();
    expect(new Date(start).toISOString()).toBe(start);
    expect(new Date(end).toISOString()).toBe(end);
  });
});

describe('upsertBypassMetrics', () => {
  it('creates new metrics row when none exists', async () => {
    const selectChain = createMetricsSelectChain({ data: null, error: null });
    const upsertFn = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn(() => ({
        ...selectChain,
        upsert: upsertFn,
      })),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const result = await upsertBypassMetrics({
      supabase,
      workspaceId: 'ws-1',
      clientId: 'client-1',
    });

    expect(result.bypassCount).toBe(1);
    expect(result.totalEvents).toBe(1);
    expect(result.bypassRate).toBe(1);
  });

  it('updates existing metrics', async () => {
    const existing = {
      id: 'm-1',
      total_events: 5,
      bypass_count: 2,
      bypass_rate: '0.4000',
      window_start: '2026-04-24',
      window_end: '2026-05-24',
    };
    const updated = {
      id: 'm-1',
      total_events: 6,
      bypass_count: 3,
      bypass_rate: '0.5000',
    };

    let maybeSingleCallCount = 0;
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.maybeSingle = vi.fn().mockImplementation(() => {
      maybeSingleCallCount++;
      if (maybeSingleCallCount === 1)
        return Promise.resolve({ data: existing, error: null });
      return Promise.resolve({ data: updated, error: null });
    });
    const supabase = {
      from: vi.fn(() => chain),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const result = await upsertBypassMetrics({
      supabase,
      workspaceId: 'ws-1',
      clientId: 'client-1',
    });

    expect(result.bypassCount).toBe(3);
    expect(result.totalEvents).toBe(6);
  });

  it('throws on fetch error', async () => {
    const selectChain = createMetricsSelectChain({
      data: null,
      error: { message: 'Connection refused' },
    });
    const supabase = {
      from: vi.fn(() => ({ ...selectChain })),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    await expect(
      upsertBypassMetrics({
        supabase,
        workspaceId: 'ws-1',
        clientId: 'client-1',
      }),
    ).rejects.toMatchObject({ code: 'METRICS_FETCH_FAILED' });
  });

  it('retries on optimistic concurrency conflict (update returns null)', async () => {
    const existing = {
      id: 'm-1',
      total_events: 5,
      bypass_count: 2,
      bypass_rate: '0.4000',
      window_start: '2026-04-24',
      window_end: '2026-05-24',
    };
    const updated = {
      id: 'm-1',
      total_events: 6,
      bypass_count: 3,
      bypass_rate: '0.5000',
      window_start: '2026-04-24',
      window_end: '2026-05-24',
    };

    let maybeSingleCallCount = 0;
    let fromCallCount = 0;
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.maybeSingle = vi.fn().mockImplementation(() => {
      maybeSingleCallCount++;
      if (maybeSingleCallCount === 1)
        return Promise.resolve({ data: existing, error: null });
      if (maybeSingleCallCount === 2)
        return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: updated, error: null });
    });
    const supabase = {
      from: vi.fn(() => {
        fromCallCount++;
        return chain;
      }),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const result = await upsertBypassMetrics({
      supabase,
      workspaceId: 'ws-1',
      clientId: 'client-1',
    });

    expect(result.bypassCount).toBe(3);
    expect(result.totalEvents).toBe(6);
  });
});

describe('incrementTotalEvents', () => {
  it('increments total_events for existing metrics', async () => {
    const existing = {
      id: 'm-1',
      total_events: 5,
      bypass_count: 2,
      bypass_rate: '0.4000',
    };
    const selectChain = createMetricsSelectChain({
      data: existing,
      error: null,
    });
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    const supabase = {
      from: vi.fn(() => ({ ...selectChain, ...updateChain })),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    await incrementTotalEvents(supabase, 'ws-1', 'client-1');

    expect(supabase.from).toHaveBeenCalledWith('calendar_bypass_metrics');
  });

  it('does nothing when no existing metrics', async () => {
    const selectChain = createMetricsSelectChain({ data: null, error: null });
    const supabase = {
      from: vi.fn(() => ({ ...selectChain })),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    await incrementTotalEvents(supabase, 'ws-1', 'client-1');

    expect(supabase.from).toHaveBeenCalledWith('calendar_bypass_metrics');
  });

  it('throws on fetch error', async () => {
    const selectChain = createMetricsSelectChain({
      data: null,
      error: { message: 'DB error' },
    });
    const supabase = {
      from: vi.fn(() => ({ ...selectChain })),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    await expect(
      incrementTotalEvents(supabase, 'ws-1', 'client-1'),
    ).rejects.toMatchObject({ code: 'METRICS_FETCH_FAILED' });
  });
});

describe('getBypassMetricsForClient', () => {
  it('returns metrics when found', async () => {
    const existing = {
      id: 'm-1',
      total_events: 10,
      bypass_count: 3,
      bypass_rate: '0.3000',
      window_start: '2026-04-24',
      window_end: '2026-05-24',
    };
    const selectChain = createMetricsSelectChain({
      data: existing,
      error: null,
    });
    const supabase = {
      from: vi.fn(() => ({ ...selectChain })),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const result = await getBypassMetricsForClient(
      supabase,
      'ws-1',
      'client-1',
    );

    expect(result).not.toBeNull();
    expect(result!.total_events).toBe(10);
  });

  it('returns null when no metrics', async () => {
    const selectChain = createMetricsSelectChain({ data: null, error: null });
    const supabase = {
      from: vi.fn(() => ({ ...selectChain })),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const result = await getBypassMetricsForClient(
      supabase,
      'ws-1',
      'client-1',
    );

    expect(result).toBeNull();
  });
});
