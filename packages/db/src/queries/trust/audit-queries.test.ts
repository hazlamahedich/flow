import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../client', () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from '../../client';
import { getCheckInDue, getRecentAutoActions } from './audit-queries';

function mockSingleResult(table: string, result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chainMethods = ['select', 'eq', 'in', 'gte', 'lte', 'order', 'range', 'limit', 'gt'];
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(async () => result);
  builder.maybeSingle = vi.fn(async () => result);

  const fromFn = vi.fn((t: string) => {
    if (t === table) return builder;
    const emptyBuilder: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const m of chainMethods) {
      emptyBuilder[m] = vi.fn(() => emptyBuilder);
    }
    emptyBuilder.single = vi.fn(async () => ({ data: null, error: null }));
    return emptyBuilder;
  });

  vi.mocked(createServiceClient).mockReturnValue({ from: fromFn, rpc: vi.fn() } as never);
  return { builder, fromFn };
}

describe('getCheckInDue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty when opt-in disabled (settings missing key)', async () => {
    mockSingleResult('workspaces', {
      data: { settings: {} },
      error: null,
    });
    const result = await getCheckInDue('ws-1');
    expect(result).toEqual([]);
  });

  it('returns empty when opt-in setting is string "false"', async () => {
    mockSingleResult('workspaces', {
      data: { settings: { trust_checkin_enabled: 'false' } },
      error: null,
    });
    const result = await getCheckInDue('ws-1');
    expect(result).toEqual([]);
  });

  it('returns empty when opt-in setting is false boolean', async () => {
    mockSingleResult('workspaces', {
      data: { settings: { trust_checkin_enabled: false } },
      error: null,
    });
    const result = await getCheckInDue('ws-1');
    expect(result).toEqual([]);
  });

  it('throws when workspace query fails', async () => {
    mockSingleResult('workspaces', {
      data: null,
      error: { message: 'fail' },
    });
    await expect(getCheckInDue('ws-1')).rejects.toThrow();
  });
});

describe('getRecentAutoActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no actions found', async () => {
    mockSingleResult('agent_runs', {
      data: null,
      error: null,
    });
    const result = await getRecentAutoActions('ws-1', 'inbox');
    expect(result).toEqual([]);
  });

  it('returns mapped rows when data exists', async () => {
    const { builder } = mockSingleResult('agent_runs', {
      data: null,
      error: null,
    });

    const mockData = [
      { id: 'r1', agent_id: 'inbox', action_type: 'general', status: 'completed', created_at: '2025-02-25T00:00:00Z', summary: 'test' },
    ];
    builder.limit = vi.fn(async () => ({ data: mockData, error: null })) as never;

    const result = await getRecentAutoActions('ws-1', 'inbox');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('r1');
    expect(result[0]?.agentId).toBe('inbox');
  });

  it('clamps limit to min 5', async () => {
    const { builder } = mockSingleResult('agent_runs', {
      data: null,
      error: null,
    });
    let capturedLimit = 0;
    builder.limit = vi.fn((n: number) => { capturedLimit = n; return builder; }) as never;
    builder.gt = vi.fn(() => builder) as never;
    builder.order = vi.fn(() => builder) as never;
    builder.eq = vi.fn(() => builder) as never;
    builder.select = vi.fn(() => builder) as never;

    await getRecentAutoActions('ws-1', 'inbox', 2);
    expect(capturedLimit).toBe(5);
  });

  it('clamps limit to max 10', async () => {
    const { builder } = mockSingleResult('agent_runs', {
      data: null,
      error: null,
    });
    let capturedLimit = 0;
    builder.limit = vi.fn((n: number) => { capturedLimit = n; return builder; }) as never;
    builder.gt = vi.fn(() => builder) as never;
    builder.order = vi.fn(() => builder) as never;
    builder.eq = vi.fn(() => builder) as never;
    builder.select = vi.fn(() => builder) as never;

    await getRecentAutoActions('ws-1', 'inbox', 20);
    expect(capturedLimit).toBe(10);
  });

  it('throws when query fails', async () => {
    const { builder } = mockSingleResult('agent_runs', {
      data: null,
      error: { message: 'db error' },
    });
    builder.limit = vi.fn(async () => ({ data: null, error: { message: 'db error' } })) as never;

    await expect(getRecentAutoActions('ws-1', 'inbox')).rejects.toThrow();
  });
});
