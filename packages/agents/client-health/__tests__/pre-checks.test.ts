import { describe, test, expect, vi, beforeEach } from 'vitest';
import { preCheck } from '../src/pre-checks';
import type { ClientHealthInput } from '../src/schemas';

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

const validInput: ClientHealthInput = {
  workspaceId: 'ba0e897a-391f-4739-b86a-e243cc05d4c8',
  clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
  snapshotDate: '2026-05-25',
  agentRunId: 'ba0e897a-391f-4739-b86a-e243cc05d4c7',
  trigger: 'cron',
};

describe('Client Health Agent — preCheck Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('passes when agent config is active and subscription is active', async () => {
    mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'ws-1', settings: { subscriptionStatus: 'active' } },
        error: null,
      }),
    });

    const result = await preCheck(validInput);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('fails when client-health agent config is inactive', async () => {
    mockGetAgentConfiguration.mockResolvedValue({ status: 'inactive' });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'ws-1', settings: { subscriptionStatus: 'active' } },
        error: null,
      }),
    });

    const result = await preCheck(validInput);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain("Agent 'client-health' is inactive");
  });

  test('fails when workspace subscription is suspended', async () => {
    mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'ws-1', settings: { subscriptionStatus: 'suspended' } },
        error: null,
      }),
    });

    const result = await preCheck(validInput);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain('subscription is suspended');
  });

  test('fails when workspace subscription is past_due', async () => {
    mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'ws-1', settings: { subscriptionStatus: 'past_due' } },
        error: null,
      }),
    });

    const result = await preCheck(validInput);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain('subscription');
  });

  test('fails when workspace is not found', async () => {
    mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    });

    const result = await preCheck(validInput);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain('Workspace not found');
  });

  test('fails when agent config is missing (null)', async () => {
    mockGetAgentConfiguration.mockResolvedValue(null);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'ws-1', settings: { subscriptionStatus: 'active' } },
        error: null,
      }),
    });

    const result = await preCheck(validInput);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain("Agent 'client-health'");
  });
});
