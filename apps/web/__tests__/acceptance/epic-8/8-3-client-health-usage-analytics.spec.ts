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
  test.skip('ClientHealthAgent class exists in packages/agents', () => {
    // RED: ClientHealthAgent not exported from @flow/agents yet.
    // DEV: Create agent in packages/agents/client-health/index.ts with run() method.
  });

  test.skip('health snapshot is stored in client_health_snapshots table', () => {
    // RED: Table client_health_snapshots does not exist yet.
    // DEV: Add migration with columns: id, workspace_id, client_id, snapshot_date, engagement_score, payment_score, communication_score, overall_health, indicators (JSONB).
  });

  test.skip('getClientHealthAction returns latest snapshot for a client', () => {
    // RED: Server action @/lib/actions/reports/get-client-health does not exist.
    // DEV: Create getClientHealthAction({ clientId }) returning latest snapshot ordered by snapshot_date DESC.
    // Given: mockSupabase returns mockClientHealthSnapshot()
    // Expect: result.data.overall_health === 'at-risk', engagement_score === 72, payment_score === 95, communication_score === 60
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Usage analytics dashboard for workspace owners
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.3-ATDD-002] workspace owners can view usage analytics with completion rates, approval rates, and trust distribution', () => {
  test.skip('getUsageAnalyticsAction is defined', () => {
    // RED: Server action @/lib/actions/reports/get-usage-analytics does not exist.
    // DEV: Create getUsageAnalyticsAction({ periodDays? }) returning aggregated metrics.
  });

  test.skip('getUsageAnalyticsAction returns aggregated metrics', () => {
    // RED: Action not implemented.
    // Given: mockSupabase returns mockUsageAnalytics()
    // Expect: result.data.agent_completion_rate === 0.87, agent_approval_rate === 0.92, trust_level_distribution.auto_approve === 12
  });

  test.skip('UsageAnalyticsPage component is exported from @/app/(workspace)/analytics/page', () => {
    // RED: Page component does not exist yet.
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Validation thesis metrics tracking
// ───────────────────────────────────────────────────────────────
describe('[P1] [8.3-ATDD-003] system tracks validation thesis metrics for product decisions', () => {
  test.skip('recordValidationMetricAction is defined', () => {
    // RED: Server action @/lib/actions/reports/record-validation-metric does not exist.
    // DEV: Create recordValidationMetricAction({ metricType, value, dimensions }) storing metric in validation_metrics table.
  });

  test.skip('recordValidationMetricAction stores metric with dimensions', () => {
    // RED: Action not implemented.
    // Given: metricType = 'agent_trust_progression', value = 0.78, dimensions = { agent_type: 'time_integrity', period: 'weekly' }
    // Expect: result.success === true, result.data.id is defined
  });

  test.skip('getValidationMetricsAction returns time-series data', () => {
    // RED: Server action @/lib/actions/reports/get-validation-metrics does not exist.
    // DEV: Create getValidationMetricsAction({ metricType, periodDays }) returning time-series array.
    // Given: mockSupabase returns [mockValidationMetric()]
    // Expect: result.data.length === 1, result.data[0].metric_type === 'agent_trust_progression'
  });
});
