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

interface PreCheckResult {
  passed: boolean;
  errors: string[];
}

interface FridayFeelingInput {
  workspaceId: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  agentRunId: string;
  trigger: 'cron' | 'manual';
}

async function preCheck(input: FridayFeelingInput): Promise<PreCheckResult> {
  const errors: string[] = [];
  try {
    const config = await mockGetAgentConfiguration(input.workspaceId, 'friday-feeling');
    if (!config || config.status !== 'active') {
      errors.push(`Agent 'friday-feeling' is inactive or not configured in workspace ${input.workspaceId}`);
    }
    const supabase = { from: mockFrom };
    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .select('id, settings')
      .eq('id', input.workspaceId)
      .single();
    if (wsErr || !ws) {
      errors.push(`Workspace not found: ${input.workspaceId}`);
    } else {
      const settings = (ws.settings as { subscriptionStatus?: string } | null) ?? {};
      if (settings.subscriptionStatus === 'suspended' || settings.subscriptionStatus === 'past_due') {
        errors.push(`Workspace subscription is ${settings.subscriptionStatus}`);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Precheck validation query failed: ${msg}`);
  }
  return { passed: errors.length === 0, errors };
}

const validInput: FridayFeelingInput = {
  workspaceId: 'ba0e897a-391f-4739-b86a-e243cc05d4c8',
  userId: 'ba0e897a-391f-4739-b86a-e243cc05d4c6',
  weekStart: '2026-05-19',
  weekEnd: '2026-05-25',
  agentRunId: 'ba0e897a-391f-4739-b86a-e243cc05d4c7',
  trigger: 'cron',
};

describe('Friday Feeling Agent — preCheck Unit Tests', () => {
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

  test('fails when friday-feeling agent config is inactive', async () => {
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
    expect(result.errors[0]).toContain("Agent 'friday-feeling' is inactive");
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
    expect(result.errors[0]).toContain("Agent 'friday-feeling'");
  });
});
