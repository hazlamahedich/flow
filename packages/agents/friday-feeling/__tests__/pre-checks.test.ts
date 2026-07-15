import { describe, test, expect, vi, beforeEach } from 'vitest';

const { mockGetAgentConfiguration, mockFrom } = vi.hoisted(() => ({
  mockGetAgentConfiguration: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  getAgentConfiguration: mockGetAgentConfiguration,
  createServiceClient: vi.fn().mockReturnValue({
    from: mockFrom,
  }),
}));

import { preCheck } from '../src/pre-checks';

const validInput = {
  workspaceId: 'ba0e897a-391f-4739-b86a-e243cc05d4c8',
  userId: 'ba0e897a-391f-4739-b86a-e243cc05d4c6',
  weekStart: '2026-05-19',
  weekEnd: '2026-05-25',
  agentRunId: 'ba0e897a-391f-4739-b86a-e243cc05d4c7',
  trigger: 'cron' as const,
};

function makeWorkspaceChain(settings: Record<string, unknown>) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: 'ws-1', settings },
      error: null,
    }),
  };
}

describe('Friday Feeling Agent — preCheck Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('passes when agent config is active and subscription is active', async () => {
    mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });
    mockFrom.mockReturnValue(
      makeWorkspaceChain({ subscriptionStatus: 'active' }),
    );

    const result = await preCheck(validInput);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('fails when friday-feeling agent config is inactive', async () => {
    mockGetAgentConfiguration.mockResolvedValue({ status: 'inactive' });
    mockFrom.mockReturnValue(
      makeWorkspaceChain({ subscriptionStatus: 'active' }),
    );

    const result = await preCheck(validInput);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain("Agent 'friday-feeling' is inactive");
  });

  test('fails when workspace subscription is suspended', async () => {
    mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });
    mockFrom.mockReturnValue(
      makeWorkspaceChain({ subscriptionStatus: 'suspended' }),
    );

    const result = await preCheck(validInput);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain('subscription is suspended');
  });

  test('fails when workspace subscription is past_due', async () => {
    mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });
    mockFrom.mockReturnValue(
      makeWorkspaceChain({ subscriptionStatus: 'past_due' }),
    );

    const result = await preCheck(validInput);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain('subscription');
  });

  test('fails when workspace is not found', async () => {
    mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Not found' } }),
    });

    const result = await preCheck(validInput);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain('Workspace not found');
  });

  test('fails when agent config is missing (null)', async () => {
    mockGetAgentConfiguration.mockResolvedValue(null);
    mockFrom.mockReturnValue(
      makeWorkspaceChain({ subscriptionStatus: 'active' }),
    );

    const result = await preCheck(validInput);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain("Agent 'friday-feeling'");
  });
});
