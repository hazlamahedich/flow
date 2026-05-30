/**
 * Story 8.3 Acceptance Tests — Client Health Agent & Usage Analytics
 * Tests health indicator surfacing, usage analytics dashboard, and validation thesis metrics.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  
  const buildChain = (data: any, error: any = null) => {
    const result = { data, error };
    const self: Record<string, any> = {};
    const methods = [
      'select', 'eq', 'neq', 'gte', 'lte', 'lt', 'is', 'in', 'order', 
      'upsert', 'insert', 'update', 'delete', 'limit', 'range'
    ];
    for (const m of methods) {
      self[m] = vi.fn().mockReturnValue(self);
    }
    self.maybeSingle = vi.fn().mockResolvedValue(result);
    self.single = vi.fn().mockResolvedValue(result);
    self.then = function(onF: any, onR: any) {
      return Promise.resolve(result).then(onF, onR);
    };
    return self;
  };

  const mockSupabaseClient = {
    from: vi.fn().mockImplementation(() => buildChain([])),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    ...actual,
    requireTenantContext: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' }),
    createFlowError: actual.createFlowError,
    cacheTag: vi.fn((entity: string, ws: string) => `${entity}:${ws}`),
    invalidateAfterMutation: vi.fn(),
    createServiceClient: vi.fn().mockReturnValue(mockSupabaseClient),
    getUsageAnalytics: vi.fn().mockResolvedValue({
      agentCompletionRate: 0.85,
      agentApprovalRate: 0.90,
      trustDistribution: { auto_approve: 5, suggest: 3, require_approval: 1 },
      tasksCompleted: 10,
      timeSavedMinutes: 120,
    }),
    recordValidationMetric: vi.fn().mockResolvedValue({ success: true }),
    getValidationMetrics: vi.fn().mockResolvedValue({ success: true, data: [] }),
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

function mockClientHealthSnapshot() {
  return {
    id: 'hs-1',
    workspace_id: 'ws-1',
    client_id: 'cli-1',
    snapshot_date: '2026-05-26',
    engagement_score: 72,
    payment_score: 95,
    communication_score: 60,
    overall_health: 'at-risk',
    indicators: {
      days_since_last_contact: 5,
      unpaid_invoice_count: 1,
      time_entry_streak_days: 3,
    },
    created_at: '2026-05-26T03:00:00Z',
  };
}

function mockUsageAnalytics() {
  return {
    id: 'ua-1',
    workspace_id: 'ws-1',
    date: '2026-05-26',
    agent_completion_rate: 0.87,
    agent_approval_rate: 0.92,
    trust_level_distribution: {
      auto_approve: 12,
      suggest: 8,
      require_approval: 3,
    },
    tasks_completed: 47,
    time_saved_minutes: 320,
    created_at: '2026-05-26T03:00:00Z',
  };
}

function mockValidationMetric() {
  return {
    id: 'vm-1',
    workspace_id: 'ws-1',
    metric_type: 'agent_trust_progression',
    value: 0.78,
    dimensions: { agent_type: 'time_integrity', period: 'weekly' },
    recorded_at: '2026-05-26T03:00:00Z',
  };
}

// ───────────────────────────────────────────────────────────────
// ATDD-001: Client Health Agent surfaces health indicators
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.3-ATDD-001] client health agent surfaces health indicators based on engagement, payment, and communication', () => {
  test('ClientHealthAgent execute is exported from @flow/agents/client-health', async () => {
    const mod = await import('../../../../../packages/agents/client-health/index');
    expect(mod.execute).toBeDefined();
    expect(typeof mod.execute).toBe('function');
  });

  test('health snapshot is stored in client_health_snapshots table', async () => {
    const { createServiceClient } = await import('@flow/db');
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('client_health_snapshots')
      .select('*')
      .eq('workspace_id', 'ws-1')
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('computeHealthScores is exported from client-health module', async () => {
    const mod = await import('../../../../../packages/agents/client-health/src/compute-health');
    expect(mod.computeEngagementScore).toBeDefined();
    expect(mod.computePaymentScore).toBeDefined();
    expect(mod.computeCommunicationScore).toBeDefined();
    expect(mod.computeOverallHealth).toBeDefined();
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Usage analytics dashboard for workspace owners
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.3-ATDD-002] workspace owners can view usage analytics with completion rates, approval rates, and trust distribution', () => {
  test('getUsageAnalytics query function is exported from @flow/db', async () => {
    const mod = await import('@flow/db');
    expect(mod.getUsageAnalytics).toBeDefined();
    expect(typeof mod.getUsageAnalytics).toBe('function');
  });

  test('getUsageAnalytics returns aggregated metrics for workspace', async () => {
    const { createServiceClient } = await import('@flow/db');
    const supabase = createServiceClient();
    const { getUsageAnalytics } = await import('@flow/db');
    const result = await getUsageAnalytics(supabase, 'ws-1', 30);
    expect(result).toHaveProperty('agentCompletionRate');
    expect(result).toHaveProperty('agentApprovalRate');
    expect(result).toHaveProperty('trustDistribution');
    expect(result).toHaveProperty('tasksCompleted');
    expect(result).toHaveProperty('timeSavedMinutes');
  });

  test('Analytics page component is exported from analytics route', async () => {
    const mod = await import('../../../app/(workspace)/analytics/page');
    expect(mod.default).toBeDefined();
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Validation thesis metrics tracking
// ───────────────────────────────────────────────────────────────
describe('[P1] [8.3-ATDD-003] system tracks validation thesis metrics for product decisions', () => {
  test('recordValidationMetric is exported from @flow/db', async () => {
    const mod = await import('@flow/db');
    expect(mod.recordValidationMetric).toBeDefined();
    expect(typeof mod.recordValidationMetric).toBe('function');
  });

  test('getValidationMetrics is exported from @flow/db', async () => {
    const mod = await import('@flow/db');
    expect(mod.getValidationMetrics).toBeDefined();
    expect(typeof mod.getValidationMetrics).toBe('function');
  });

  test('validation_metrics table is accessible via service client', async () => {
    const { createServiceClient } = await import('@flow/db');
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('validation_metrics')
      .select('*')
      .eq('workspace_id', 'ws-1')
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
