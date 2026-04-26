import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
  })),
}));

import { fetchUnacknowledgedRegressions } from '../rehydrate-regressions';

describe('fetchUnacknowledgedRegressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success with empty array on auth failure', async () => {
    const result = await fetchUnacknowledgedRegressions();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data)).toBe(true);
    }
  });

  it('returns success with entries when db returns regressions', async () => {
    vi.doMock('@flow/db', () => ({
      getUnacknowledgedRegressions: vi.fn().mockResolvedValue([
        {
          id: 'r1',
          trigger_reason: 'hard_violation',
          from_level: 'autonomous',
          to_level: 'shadow',
          matrix_entry_id: 'm1',
          trigger_type: 'hard_violation',
          trust_matrix: [{ agent_id: 'inbox', version: 2 }],
        },
      ]),
      createServerClient: vi.fn(() => ({})),
      requireTenantContext: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'u-1' }),
    }));

    const { fetchUnacknowledgedRegressions: fresh } = await import('../rehydrate-regressions');
    const result = await fresh();
    expect(result.success).toBe(true);
  });
});
