import { describe, test, expect, vi, beforeEach } from 'vitest';
import { execute } from '../executor';
import type { WeeklyReportInput } from '../schemas';

const {
  mockAggregateReportData,
  mockCheckBudgetThreshold,
  mockInsertCostEstimate,
  mockInsertCostLog,
  mockFrom,
  mockRpc,
  mockComplete,
} = vi.hoisted(() => ({
  mockAggregateReportData: vi.fn(),
  mockCheckBudgetThreshold: vi.fn(),
  mockInsertCostEstimate: vi.fn(),
  mockInsertCostLog: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockComplete: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  aggregateReportData: mockAggregateReportData,
  checkBudgetThreshold: mockCheckBudgetThreshold,
  insertCostEstimate: mockInsertCostEstimate,
  insertCostLog: mockInsertCostLog,
  createServiceClient: vi.fn().mockReturnValue({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

vi.mock('../../shared/llm-router', () => ({
  createLLMRouter: vi.fn().mockReturnValue({
    complete: mockComplete,
  }),
}));

describe('Weekly Report Agent — execute Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should successfully compile report and persist draft when budget is valid', async () => {
    // 1. Cooldown query returns no active cooldown
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(async () => {
        // Cooldown select or client select
        if (mockFrom.mock.calls.length === 1) {
          // Cooldown check: return empty list
          return { data: [], error: null };
        }
        if (mockFrom.mock.calls.length === 2) {
          // Client details select
          return { data: { id: 'cli-1', name: 'Acme Corp' }, error: null };
        }
        if (mockFrom.mock.calls.length === 3) {
          // Report template select
          return { data: null, error: null };
        }
        if (mockFrom.mock.calls.length === 4) {
          // Agent configurations select
          return {
            data: { llm_preferences: { trustLevel: 'supervised' } },
            error: null,
          };
        }
        if (mockFrom.mock.calls.length === 5) {
          // Workspace members role check select
          return { data: { user_id: 'usr-1' }, error: null };
        }
        return { data: null, error: null };
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      gt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    });

    // 2. Budget is allowed
    mockCheckBudgetThreshold.mockResolvedValue({
      allowed: true,
      percentUsed: 0.1,
    });

    // 3. Pre-aggregated data exists
    mockAggregateReportData.mockResolvedValue({
      hasActivity: true,
      timeSummary: { totalMinutes: 1200, projectCount: 1 },
      taskLog: { projects: [] },
      agentActivity: { runs: [] },
      invoiceSummary: {
        totalCents: 50000,
        amountPaidCents: 0,
        invoiceCount: 1,
      },
      stalledItems: [],
    });

    // 4. LLM narrative generation succeeds
    mockComplete.mockResolvedValue({
      text: JSON.stringify({
        time_summary: 'We logged 20 hours.',
        task_log: 'Completed several deliverables.',
        highlights: 'Great week!',
      }),
    });

    // 5. Supabase RPC successful insert
    mockRpc.mockResolvedValue({ data: 'rpt-1', error: null });

    const input: WeeklyReportInput = {
      workspaceId: 'ba0e897a-391f-4739-b86a-e243cc05d4c8',
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
      agentRunId: 'ba0e897a-391f-4739-b86a-e243cc05d4c7',
      trigger: 'cron',
    };

    const result = await execute(input);
    expect(result.reportId).toBe('rpt-1');
    expect(result.title).toContain('Acme Corp');
    expect(result.confidence).toBe(0.95);
  });

  test('should fail when monthly budget is exhausted', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(async () => {
        if (mockFrom.mock.calls.length === 1) return { data: [], error: null }; // cooldown
        return { data: { id: 'cli-1', name: 'Acme Corp' }, error: null };
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      gt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    });

    mockCheckBudgetThreshold.mockResolvedValue({
      allowed: false,
      percentUsed: 1.2,
    });

    const input: WeeklyReportInput = {
      workspaceId: 'ba0e897a-391f-4739-b86a-e243cc05d4c8',
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
      agentRunId: 'ba0e897a-391f-4739-b86a-e243cc05d4c7',
      trigger: 'cron',
    };

    await expect(execute(input)).rejects.toThrow('LLM Budget exceeded');
  });
});
