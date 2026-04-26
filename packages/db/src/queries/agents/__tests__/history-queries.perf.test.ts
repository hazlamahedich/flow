import { describe, it, expect, vi } from 'vitest';

const mockRange = vi.fn(() => Promise.resolve({ data: [], count: 0, error: null }));
const mockLimit = vi.fn(() => Promise.resolve({ data: [], error: null }));
const chain = {
  eq: vi.fn(() => chain),
  select: vi.fn(() => chain),
  order: vi.fn(() => chain),
  limit: mockLimit,
  range: mockRange,
  in: vi.fn(() => chain),
  not: vi.fn(() => chain),
};
vi.mock('../../../client', () => ({
  createServiceClient: vi.fn(() => ({ from: vi.fn(() => chain), rpc: vi.fn(() => Promise.resolve({ data: [], error: null })) })),
}));

import { getActionHistory, getCoordinationGroups, getRecentActivity } from '../history-queries';

describe.skip('Performance tests (run locally with real DB)', () => {
  it('getActionHistory with 1000+ runs completes < 500ms', async () => {
    const start = performance.now();
    await getActionHistory('ws-perf', 'u1');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('getCoordinationGroups with 50+ groups completes < 1s', async () => {
    const start = performance.now();
    await getCoordinationGroups('ws-perf');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it('getRecentActivity completes < 500ms', async () => {
    const start = performance.now();
    await getRecentActivity('ws-perf');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
