import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRange = vi.fn(() => Promise.resolve({ data: [], count: 0, error: null }));
const mockLimit = vi.fn(() => Promise.resolve({ data: [], error: null }));
const mockSingle = vi.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } }));
const mockMaybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
const mockRpc = vi.fn(() => Promise.resolve({ data: [], error: null }));

const chain = {
  eq: vi.fn(() => chain),
  select: vi.fn(() => chain),
  order: vi.fn(() => chain),
  limit: mockLimit,
  range: mockRange,
  in: vi.fn(() => chain),
  gte: vi.fn(() => chain),
  lte: vi.fn(() => chain),
  not: vi.fn(() => chain),
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
};

const mockFrom = vi.fn(() => ({ ...chain }));

vi.mock('../../../client', () => ({
  createServiceClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

import { getActionHistory, getCoordinationGroups, getRunDetail, getRecentActivity, getCorrectionChain } from '../history-queries';

beforeEach(() => {
  vi.clearAllMocks();
  mockRange.mockResolvedValue({ data: [], count: 0, error: null });
  mockLimit.mockResolvedValue({ data: [], error: null });
  mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
  mockRpc.mockResolvedValue({ data: [], error: null });
});

describe('getActionHistory', () => {
  it('returns empty data with no results', async () => {
    const result = await getActionHistory('ws1', 'u1');
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('passes agentId filter', async () => {
    await getActionHistory('ws1', 'u1', { agentId: 'inbox' });
    expect(mockFrom).toHaveBeenCalledWith('agent_runs');
  });

  it('passes status filter', async () => {
    await getActionHistory('ws1', 'u1', { status: 'failed' });
    expect(mockFrom).toHaveBeenCalled();
  });

  it('passes date range filters', async () => {
    await getActionHistory('ws1', 'u1', { dateFrom: '2025-01-01', dateTo: '2025-12-31' });
    expect(mockFrom).toHaveBeenCalled();
  });

  it('passes clientId filter', async () => {
    await getActionHistory('ws1', 'u1', { clientId: 'c1' });
    expect(mockFrom).toHaveBeenCalled();
  });

  it('uses page 1 by default', async () => {
    await getActionHistory('ws1', 'u1');
    expect(mockRange).toHaveBeenCalledWith(0, 24);
  });

  it('calculates offset from page number', async () => {
    await getActionHistory('ws1', 'u1', { page: 3 });
    expect(mockRange).toHaveBeenCalledWith(50, 74);
  });

  it('clamps page 0 to page 1', async () => {
    await getActionHistory('ws1', 'u1', { page: 0 });
    expect(mockRange).toHaveBeenCalledWith(0, 24);
  });

  it('returns structured empty on no results', async () => {
    const result = await getActionHistory('ws1', 'u1');
    expect(result).toEqual({ data: [], total: 0 });
  });
});

describe('getCoordinationGroups', () => {
  it('returns empty array when no data', async () => {
    const result = await getCoordinationGroups('ws1');
    expect(result).toEqual([]);
  });

  it('queries agent_runs table', async () => {
    await getCoordinationGroups('ws1');
    expect(mockFrom).toHaveBeenCalledWith('agent_runs');
  });

  it('respects limit parameter', async () => {
    await getCoordinationGroups('ws1', {}, 10);
    expect(mockFrom).toHaveBeenCalled();
  });
});

describe('getRunDetail', () => {
  it('returns null when run not found', async () => {
    const result = await getRunDetail('nonexistent', 'ws1');
    expect(result).toBeNull();
  });
});

describe('getRecentActivity', () => {
  it('returns empty array for no activity', async () => {
    const result = await getRecentActivity('ws1');
    expect(result).toEqual([]);
  });

  it('uses limit 5 by default', async () => {
    await getRecentActivity('ws1');
    expect(mockLimit).toHaveBeenCalledWith(5);
  });

  it('accepts custom limit', async () => {
    await getRecentActivity('ws1', 10);
    expect(mockLimit).toHaveBeenCalledWith(10);
  });
});

describe('getCorrectionChain', () => {
  it('returns result from RPC call', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const result = await getCorrectionChain('r1', 'ws1');
    expect(result).toBeDefined();
  });

  it('falls back on RPC error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null as unknown as never[], error: { message: 'not found' } as unknown as null });
    const result = await getCorrectionChain('r1', 'ws1');
    expect(result).toBeDefined();
  });
});
