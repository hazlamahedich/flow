import { describe, it, expect, vi } from 'vitest';
import { getRetainerUtilization } from '../utilization';
import type { SupabaseClient } from '@supabase/supabase-js';

function builder(resolvedValue: unknown, thenable = false) {
  const b: Record<string, ReturnType<typeof vi.fn>> = {};
  b.eq = vi.fn().mockImplementation(() => b);
  b.gte = vi.fn().mockImplementation(() => b);
  b.lt = vi.fn().mockImplementation(() => b);
  b.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  b.select = vi.fn().mockImplementation(() => b);
  if (thenable) {
    b.then = vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve(resolvedValue)),
    );
    b.catch = vi.fn().mockImplementation(() => Promise.resolve(resolvedValue));
  }
  return b;
}

function createMockClient(
  retainerResult: { data: unknown; error: unknown },
  entriesResult: { data: unknown; error: unknown },
) {
  const retainerBuilder = builder(retainerResult, false);
  const entriesBuilder = builder(entriesResult, true);
  let fromCall = 0;
  const from = vi.fn().mockImplementation(() => {
    fromCall++;
    return fromCall === 1 ? retainerBuilder : entriesBuilder;
  });
  return { from } as unknown as SupabaseClient;
}

describe('getRetainerUtilization', () => {
  it('returns null when no active retainer found', async () => {
    const client = createMockClient(
      { data: null, error: null },
      { data: [], error: null },
    );
    const result = await getRetainerUtilization(client, { retainerId: 'r1', workspaceId: 'w1' });
    expect(result).toBeNull();
  });

  it('returns informational result for hourly_rate type', async () => {
    const retainer = {
      id: 'r1', client_id: 'c1', workspace_id: 'w1', type: 'hourly_rate',
      hourly_rate_cents: 5000, monthly_hours_threshold: null, package_hours: null,
      billing_period_days: 30, start_date: '2026-01-01',
    };
    const client = createMockClient(
      { data: retainer, error: null },
      { data: [{ duration_minutes: 120 }], error: null },
    );

    const result = await getRetainerUtilization(client, { retainerId: 'r1', workspaceId: 'w1' });
    expect(result).not.toBeNull();
    expect(result!.totalMinutes).toBe(120);
    expect(result!.allocatedMinutes).toBe(0);
    expect(result!.utilizationPercent).toBe(0);
  });
});
