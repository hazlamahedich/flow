import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}));

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

import { getTrustSummaryForWorkspace, getTrustMilestones } from '../trust-summary';

const WS_ID = '00000000-0000-0000-0000-000000000001';

function setupQuery(data: unknown[] | null, error: unknown | null) {
  const chainable: Record<string, unknown> = { data, error, eq: mockEq };
  mockEq.mockReturnValue(chainable);
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

describe('getTrustSummaryForWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped rows for a workspace', async () => {
    setupQuery([
      {
        workspace_id: WS_ID,
        agent_id: 'inbox',
        current_level: 'supervised',
        score: 50,
        consecutive_successes: 3,
        total_executions: 10,
        successful_executions: 8,
        violation_count: 1,
        last_transition_at: '2025-01-01T00:00:00Z',
        last_violation_at: null,
        action_type: 'general',
      },
    ], null);

    const result = await getTrustSummaryForWorkspace(WS_ID);
    expect(result).toHaveLength(1);
    expect(result[0]!.agentId).toBe('inbox');
    expect(result[0]!.currentLevel).toBe('supervised');
    expect(result[0]!.score).toBe(50);
  });

  it('returns empty array when no data', async () => {
    setupQuery(null, null);

    const result = await getTrustSummaryForWorkspace(WS_ID);
    expect(result).toEqual([]);
  });

  it('throws on database error', async () => {
    setupQuery(null, { message: 'db error', code: 'XX000' });

    await expect(getTrustSummaryForWorkspace(WS_ID)).rejects.toEqual({ message: 'db error', code: 'XX000' });
  });

  it('maps snake_case to camelCase', async () => {
    setupQuery([{
      workspace_id: WS_ID,
      agent_id: 'calendar',
      current_level: 'auto',
      score: 180,
      consecutive_successes: 50,
      total_executions: 100,
      successful_executions: 98,
      violation_count: 0,
      last_transition_at: '2025-01-01T00:00:00Z',
      last_violation_at: null,
      action_type: 'general',
    }], null);

    const result = await getTrustSummaryForWorkspace(WS_ID);
    expect(result[0]!.workspaceId).toBe(WS_ID);
    expect(result[0]!.totalExecutions).toBe(100);
    expect(result[0]!.successfulExecutions).toBe(98);
    expect(result[0]!.consecutiveSuccesses).toBe(50);
  });

  it('queries the trust_matrix table', async () => {
    setupQuery([], null);

    await getTrustSummaryForWorkspace(WS_ID);
    expect(mockFrom).toHaveBeenCalledWith('trust_matrix');
  });

  it('handles partial data with null violation', async () => {
    setupQuery([{
      workspace_id: WS_ID,
      agent_id: 'inbox',
      current_level: 'supervised',
      score: 20,
      consecutive_successes: 0,
      total_executions: 3,
      successful_executions: 1,
      violation_count: 2,
      last_transition_at: '2025-01-01T00:00:00Z',
      last_violation_at: null,
      action_type: 'general',
    }], null);

    const result = await getTrustSummaryForWorkspace(WS_ID);
    expect(result[0]!.lastViolationAt).toBeNull();
    expect(result[0]!.violationCount).toBe(2);
  });
});

describe('getTrustMilestones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped milestones', async () => {
    setupQuery([{
      agent_id: 'inbox',
      milestone_type: 'hundred_tasks',
      threshold: 100,
      achieved_at: '2025-03-01T00:00:00Z',
      acknowledged_at: null,
    }], null);

    const result = await getTrustMilestones(WS_ID);
    expect(result).toHaveLength(1);
    expect(result[0]!.agentId).toBe('inbox');
    expect(result[0]!.milestoneType).toBe('hundred_tasks');
    expect(result[0]!.acknowledgedAt).toBeNull();
  });

  it('queries trust_milestones table', async () => {
    setupQuery([], null);

    await getTrustMilestones(WS_ID);
    expect(mockFrom).toHaveBeenCalledWith('trust_milestones');
  });

  it('returns empty when no data', async () => {
    setupQuery(null, null);

    const result = await getTrustMilestones(WS_ID);
    expect(result).toEqual([]);
  });

  it('throws on database error', async () => {
    setupQuery(null, { message: 'fail' });

    await expect(getTrustMilestones(WS_ID)).rejects.toEqual({ message: 'fail' });
  });
});
