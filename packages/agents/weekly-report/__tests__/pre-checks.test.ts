import { describe, test, expect, vi, beforeEach } from 'vitest';
import { preCheck } from '../pre-check';
import type { WeeklyReportInput, WeeklyReportProposal } from '../schemas';

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

describe('Weekly Report Agent — preCheck Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should pass for a valid input when configuration is active and subscription is active', async () => {
    mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'ws-1', settings: { subscriptionStatus: 'active' } },
        error: null,
      }),
    });

    const input: WeeklyReportInput = {
      workspaceId: 'ba0e897a-391f-4739-b86a-e243cc05d4c8',
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
      agentRunId: 'ba0e897a-391f-4739-b86a-e243cc05d4c7',
      trigger: 'cron',
    };

    const result = await preCheck(input);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should fail if the weekly-report agent configuration is inactive', async () => {
    mockGetAgentConfiguration.mockResolvedValue({ status: 'inactive' });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'ws-1', settings: { subscriptionStatus: 'active' } },
        error: null,
      }),
    });

    const input: WeeklyReportInput = {
      workspaceId: 'ba0e897a-391f-4739-b86a-e243cc05d4c8',
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
      agentRunId: 'ba0e897a-391f-4739-b86a-e243cc05d4c7',
      trigger: 'cron',
    };

    const result = await preCheck(input);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain("Agent 'weekly-report' is inactive");
  });

  test('should fail if the workspace subscription is suspended', async () => {
    mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'ws-1', settings: { subscriptionStatus: 'suspended' } },
        error: null,
      }),
    });

    const input: WeeklyReportInput = {
      workspaceId: 'ba0e897a-391f-4739-b86a-e243cc05d4c8',
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
      agentRunId: 'ba0e897a-391f-4739-b86a-e243cc05d4c7',
      trigger: 'cron',
    };

    const result = await preCheck(input);
    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain('subscription is suspended');
  });

  test('should pass for a valid WeeklyReportProposal', async () => {
    const proposal: WeeklyReportProposal = {
      title: 'Weekly Report for Client A',
      confidence: 0.95,
      reasoning: 'Prose summary compiled from time logs.',
      riskLevel: 'low',
      preview: 'Preview details...',
    };

    const result = await preCheck(proposal);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should fail for an invalid WeeklyReportProposal with missing fields', async () => {
    const proposal = {
      confidence: 1.5, // invalid
      reasoning: '', // missing
    } as unknown as WeeklyReportProposal;

    const result = await preCheck(proposal);
    expect(result.passed).toBe(false);
    expect(result.errors).toContain('Proposal title is missing');
    expect(result.errors).toContain(
      'Proposal confidence must be between 0 and 1',
    );
    expect(result.errors).toContain('Proposal reasoning is missing');
  });
});
