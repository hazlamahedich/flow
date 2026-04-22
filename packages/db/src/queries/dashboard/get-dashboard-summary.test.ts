import { describe, it, expect, vi, type Mock } from 'vitest';
import { getDashboardSummary } from './get-dashboard-summary';

interface MockedResult {
  count: number | null;
  error: { code: string; message: string } | null;
}

function mockClient(tables: Record<string, MockedResult>) {
  const from: Mock = vi.fn((table: string) => {
    const entry = tables[table];
    const builder: Record<string, unknown> = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
    };
    let callCount = 0;
    Object.defineProperty(builder, 'then', {
      get: () => {
        callCount++;
        if (callCount > 1) return undefined;
        return (resolve: (v: MockedResult) => void) => resolve(entry ?? { count: 0, error: null });
      },
    });
    return builder;
  });
  return { from } as unknown as Parameters<typeof getDashboardSummary>[0];
}

describe('getDashboardSummary', () => {
  const workspaceId = '00000000-0000-0000-0000-000000000001';

  it('returns counts when all queries succeed', async () => {
    const client = mockClient({
      agent_approvals: { count: 3, error: null },
      agent_runs: { count: 12, error: null },
      invoices: { count: 5, error: null },
      client_health_alerts: { count: 1, error: null },
    });

    const result = await getDashboardSummary(client, workspaceId);

    expect(result).toEqual({
      pendingApprovals: 3,
      agentActivityCount: 12,
      outstandingInvoices: 5,
      clientHealthAlerts: 1,
    });
  });

  it('returns zeros when all tables missing (42P01)', async () => {
    const pgError = { code: '42P01', message: 'undefined_object' };
    const client = mockClient({
      agent_approvals: { count: null, error: pgError },
      agent_runs: { count: null, error: pgError },
      invoices: { count: null, error: pgError },
      client_health_alerts: { count: null, error: pgError },
    });

    const result = await getDashboardSummary(client, workspaceId);

    expect(result).toEqual({
      pendingApprovals: 0,
      agentActivityCount: 0,
      outstandingInvoices: 0,
      clientHealthAlerts: 0,
    });
  });

  it('returns partial counts when some tables missing', async () => {
    const pgError = { code: '42P01', message: 'undefined_object' };
    const client = mockClient({
      agent_approvals: { count: 2, error: null },
      agent_runs: { count: null, error: pgError },
      invoices: { count: 7, error: null },
      client_health_alerts: { count: null, error: pgError },
    });

    const result = await getDashboardSummary(client, workspaceId);

    expect(result).toEqual({
      pendingApprovals: 2,
      agentActivityCount: 0,
      outstandingInvoices: 7,
      clientHealthAlerts: 0,
    });
  });

  it('throws non-42P01 errors', async () => {
    const client = mockClient({
      agent_approvals: { count: null, error: { code: '42501', message: 'permission denied' } },
      agent_runs: { count: 0, error: null },
      invoices: { count: 0, error: null },
      client_health_alerts: { count: 0, error: null },
    });

    await expect(getDashboardSummary(client, workspaceId)).rejects.toThrow('permission denied');
  });

  it('queries with correct workspace_id', async () => {
    const eqArgs: Array<[string, string]> = [];
    const from: Mock = vi.fn(() => {
      const builder: Record<string, unknown> = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: string) => {
          eqArgs.push([col, val]);
          return builder;
        }),
      };
      let callCount = 0;
      Object.defineProperty(builder, 'then', {
        get: () => {
          callCount++;
          if (callCount > 1) return undefined;
          return (resolve: (v: MockedResult) => void) =>
            resolve({ count: 0, error: null });
        },
      });
      return builder;
    });

    const client = { from } as unknown as Parameters<typeof getDashboardSummary>[0];
    await getDashboardSummary(client, workspaceId);

    expect(eqArgs.length).toBe(4);
    for (const [col, val] of eqArgs) {
      expect(col).toBe('workspace_id');
      expect(val).toBe(workspaceId);
    }
  });
});
