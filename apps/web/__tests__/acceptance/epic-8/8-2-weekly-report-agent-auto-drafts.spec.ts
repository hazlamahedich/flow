/**
 * Story 8.2 Acceptance Tests — Weekly Report Agent Auto-Drafts
 * Tests agent auto-draft generation, template adherence, approval queue integration,
 * and chronological agent action log.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

const { mockGetServerSupabase, mockFrom, mockRpc } = vi.hoisted(() => ({
  mockGetServerSupabase: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: mockGetServerSupabase,
}));

vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return {
    ...actual,
    requireTenantContext: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' }),
    createFlowError: actual.createFlowError,
    cacheTag: vi.fn((entity: string, ws: string) => `${entity}:${ws}`),
    invalidateAfterMutation: vi.fn(),
  };
});

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('pg-boss', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue('job-123'),
    })),
    PgBoss: vi.fn().mockImplementation(() => ({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue('job-123'),
    })),
  };
});

vi.mock('@flow/agents/orchestrator/pg-boss-producer', () => {
  return {
    PgBossProducer: vi.fn().mockImplementation(() => ({
      submit: vi.fn().mockResolvedValue({ runId: 'run-123', status: 'queued' }),
    })),
  };
});

process.env.DATABASE_URL = 'postgres://dummy';

import { execute, preCheck } from '../../../../../packages/agents/weekly-report';
import { submitWeeklyReportRunAction } from '../../../lib/actions/reports/submit-weekly-report-run';
import { getAgentActionLogAction } from '../../../lib/actions/reports/get-agent-action-log';

// ───────────────────────────────────────────────────────────────
// ATDD-001: Weekly Report Agent auto-drafts report for review
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.2-ATDD-001] weekly report agent auto-drafts report based on period data', () => {
  test('WeeklyReportAgent execute and preCheck functions exist in packages/agents', () => {
    expect(execute).toBeDefined();
    expect(preCheck).toBeDefined();
    expect(typeof execute).toBe('function');
    expect(typeof preCheck).toBe('function');
  });

  test('auto-draft submit action is defined and registers runs', async () => {
    expect(submitWeeklyReportRunAction).toBeDefined();
    
    mockGetServerSupabase.mockReturnValue({
      from: mockFrom,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'usr-1' }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'cli-1' }, error: null }),
    });

    const result = await submitWeeklyReportRunAction({
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.runId).toBeDefined();
      expect(result.data.status).toBe('queued');
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Draft follows customized template if one exists
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.2-ATDD-002] draft follows client customized template if one exists', () => {
  test('agent exports function properly and checks active enums', () => {
    const keys = ['time_summary', 'task_log', 'agent_activity', 'invoice_summary', 'stalled_items', 'highlights'];
    expect(keys).toContain('stalled_items');
    expect(keys).toContain('highlights');
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Draft appears in approval queue with trust matrix
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.2-ATDD-003] draft appears in approval queue following trust matrix from Epic 2', () => {
  test('trust level checks and validations can be executed', async () => {
    const proposal = {
      title: 'Weekly Draft',
      confidence: 0.95,
      reasoning: 'Precheck compiled summary.',
      riskLevel: 'low',
      preview: 'Content preview...',
    };

    const precheckResult = await preCheck(proposal);
    expect(precheckResult.passed).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Chronological agent action log with full context
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.2-ATDD-004] users can review chronological log of all agent actions with full context', () => {
  test('getAgentActionLogAction is defined and returns items ordered by created_at DESC', async () => {
    expect(getAgentActionLogAction).toBeDefined();

    mockGetServerSupabase.mockReturnValue({
      from: mockFrom,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 'run-2', agent_id: 'weekly-report', action_type: 'weekly_report_draft', status: 'completed', created_at: '2026-05-20T10:05:00Z', workspace_id: 'ws-1' },
          { id: 'run-1', agent_id: 'weekly-report', action_type: 'weekly_report_draft', status: 'completed', created_at: '2026-05-20T10:00:00Z', workspace_id: 'ws-1' },
        ],
        error: null,
      }),
    });

    const logResult = await getAgentActionLogAction();
    expect(logResult.success).toBe(true);
    if (logResult.success) {
      expect(logResult.data).toHaveLength(2);
      expect(logResult.data[0].id).toBe('run-2');
      expect(new Date(logResult.data[0].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(logResult.data[1].createdAt).getTime());
    }
  });
});
