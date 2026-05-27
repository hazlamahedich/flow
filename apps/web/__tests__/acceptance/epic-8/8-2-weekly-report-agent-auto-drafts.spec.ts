/**
 * Story 8.2 Acceptance Tests — Weekly Report Agent Auto-Drafts
 * Tests agent auto-draft generation, template adherence, approval queue integration,
 * and chronological agent action log.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
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
}));

function mockSupabase(rpcResult: unknown, rpcError?: Error, rowData?: unknown) {
  const fromChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: rowData ?? null, error: null }),
    single: vi.fn().mockResolvedValue({ data: rowData ?? null, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  return {
    rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: rpcError ?? null }),
    from: vi.fn().mockReturnValue(fromChain),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

function mockWeeklyReportRow(status: string, templateId?: string | null) {
  return {
    id: 'rpt-1',
    workspace_id: 'ws-1',
    client_id: 'cli-1',
    period_start: '2026-05-19',
    period_end: '2026-05-25',
    status,
    template_id: templateId ?? null,
    generated_at: '2026-05-26T06:30:00Z',
    sent_at: null,
    created_at: '2026-05-26T06:30:00Z',
    updated_at: '2026-05-26T06:30:00Z',
  };
}

function mockAgentRun(agentType: string, status: string) {
  return {
    id: 'run-1',
    workspace_id: 'ws-1',
    agent_type: agentType,
    status,
    payload: { summary: 'Agent completed task' },
    created_at: '2026-05-20T10:00:00Z',
    completed_at: status === 'completed' ? '2026-05-20T10:05:00Z' : null,
    user_id: 'user-1',
    trust_level: 'suggest',
  };
}

function mockTrustProposal(trustLevel: string) {
  return {
    id: 'prop-1',
    workspace_id: 'ws-1',
    agent_type: 'weekly_report',
    proposal_type: 'report_draft',
    status: 'pending',
    trust_level: trustLevel,
    payload: { report_id: 'rpt-1', preview: 'Draft preview text' },
    created_at: '2026-05-26T06:30:00Z',
  };
}

// ───────────────────────────────────────────────────────────────
// ATDD-001: Weekly Report Agent auto-drafts report for review
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.2-ATDD-001] weekly report agent auto-drafts report based on period data', () => {
  test.skip('WeeklyReportAgent class exists in packages/agents', () => {
    // RED: WeeklyReportAgent not exported from @flow/agents yet.
    // DEV: Create agent in packages/agents/weekly-report/index.ts with run() method.
  });

  test.skip('auto-draft action is defined', () => {
    // RED: Server action @/lib/actions/reports/auto-draft-weekly-report does not exist.
    // DEV: Create autoDraftWeeklyReportAction({ reportId }) that triggers agent.run() and stores draft.
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Draft follows customized template if one exists
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.2-ATDD-002] draft follows client customized template if one exists', () => {
  test.skip('agent loads template before drafting', () => {
    // RED: Agent implementation missing.
    // Given: reportData with template { sections_config: { task_log: { enabled: false } } }
    // Expect: agent.run() respects template and omits disabled sections from draft.
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Draft appears in approval queue with trust matrix
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.2-ATDD-003] draft appears in approval queue following trust matrix from Epic 2', () => {
  test.skip('draft proposal is created in agent_proposals table', () => {
    // RED: autoDraftWeeklyReportAction does not create proposals yet.
    // Given: report with status 'draft'
    // Expect: After auto-draft, agent_proposals row exists with proposal_type = 'report_draft' and trust_level = 'suggest'
  });

  test.skip('trust level "suggest" requires human approval before sharing', () => {
    // RED: Trust gate integration not wired for weekly_report agent yet.
    // Expect: checkTrustLevel({ workspaceId, agentType: 'weekly_report', actionType: 'share_report' }).requiresApproval === true
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Chronological agent action log with full context
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.2-ATDD-004] users can review chronological log of all agent actions with full context', () => {
  test.skip('getAgentActionLogAction is defined', () => {
    // RED: Server action @/lib/actions/reports/get-agent-action-log does not exist.
    // DEV: Create getAgentActionLogAction({ clientId, periodStart, periodEnd }) returning AgentRun[] ordered by created_at DESC.
  });

  test.skip('agent action log returns runs ordered by created_at DESC', () => {
    // RED: Action not implemented.
    // Given: 3 agent runs with different created_at values
    // Expect: result.data[0].created_at >= result.data[1].created_at
  });

  test.skip('AgentActionLogPage component is exported from @/app/(workspace)/reports/agent-log/page', () => {
    // RED: Page component does not exist yet.
  });
});
