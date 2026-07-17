import { vi } from 'vitest';

type MockFn = ReturnType<typeof vi.fn>;

export function createChainableMock(
  overrides: Record<string, Record<string, unknown>> = {},
) {
  return {
    from: vi.fn((table: string) => {
      const tableMock = overrides[table];
      if (tableMock) return tableMock;
      const chain: Record<string, MockFn> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.insert = vi.fn().mockReturnValue(chain);
      chain.update = vi.fn().mockReturnValue(chain);
      chain.delete = vi.fn().mockReturnValue(chain);
      chain.upsert = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.neq = vi.fn().mockReturnValue(chain);
      chain.in = vi.fn().mockReturnValue(chain);
      chain.gt = vi.fn().mockReturnValue(chain);
      chain.gte = vi.fn().mockReturnValue(chain);
      chain.lte = vi.fn().mockReturnValue(chain);
      chain.or = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi
        .fn()
        .mockResolvedValue({ data: null, error: null });
      chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
      return chain;
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

export function createBypassMetricsMock(
  existingMetrics: Record<string, unknown> | null = null,
  updatedMetrics: Record<string, unknown> | null = null,
) {
  const metricsRow = updatedMetrics
    ? {
        ...updatedMetrics,
        bypass_rate:
          (updatedMetrics.bypass_rate as string) ??
          (existingMetrics?.bypass_rate as string) ??
          '0.0000',
      }
    : existingMetrics
      ? {
          id: existingMetrics.id ?? 'm-1',
          total_events: ((existingMetrics.total_events as number) ?? 0) + 1,
          bypass_count: ((existingMetrics.bypass_count as number) ?? 0) + 1,
          bypass_rate: (existingMetrics.bypass_rate as string) ?? '0.0000',
          window_start:
            (existingMetrics.window_start as string) ??
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          window_end:
            (existingMetrics.window_end as string) ?? new Date().toISOString(),
        }
      : null;

  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: existingMetrics
                  ? {
                      ...existingMetrics,
                      window_start:
                        (existingMetrics.window_start as string) ??
                        new Date(
                          Date.now() - 30 * 24 * 60 * 60 * 1000,
                        ).toISOString(),
                      window_end:
                        (existingMetrics.window_end as string) ??
                        new Date().toISOString(),
                    }
                  : null,
                error: null,
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
