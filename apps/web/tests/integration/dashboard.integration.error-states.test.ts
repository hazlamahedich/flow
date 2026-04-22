import { describe, it, expect } from 'vitest';
import { getDashboardSummary } from '@flow/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseAvailable } from '@flow/test-utils';

const skip = !isSupabaseAvailable();

describe.skipIf(skip)('Dashboard Integration — Error States', () => {
  const workspaceId = '00000000-0000-0000-0000-000000000000';

  it('returns zeros for missing tables via Promise.allSettled', async () => {
    const mockClient = {
      from: () => ({
        select: function (this: unknown) { return this; },
        eq: function (this: unknown) {
          return Promise.resolve({
            count: null,
            error: { code: '42P01', message: 'undefined_object' },
          });
        },
      }),
    } as unknown as SupabaseClient;

    const result = await getDashboardSummary(mockClient, workspaceId);

    expect(result.pendingApprovals).toBe(0);
    expect(result.agentActivityCount).toBe(0);
    expect(result.outstandingInvoices).toBe(0);
    expect(result.clientHealthAlerts).toBe(0);
  });

  it('non-42P01 error surfaces to caller', async () => {
    const mockClient = {
      from: () => ({
        select: function (this: unknown) { return this; },
        eq: function (this: unknown) {
          return Promise.resolve({
            count: null,
            error: { code: '42501', message: 'insufficient_permission' },
          });
        },
      }),
    } as unknown as SupabaseClient;

    await expect(getDashboardSummary(mockClient, workspaceId)).rejects.toThrow();
  });

  it('partial failure returns degraded zeros', async () => {
    let callIdx = 0;
    const tables = ['agent_approvals', 'agent_runs', 'invoices', 'client_health_alerts'];
    const mockClient = {
      from: () => ({
        select: function (this: unknown) { return this; },
        eq: function (this: unknown) {
          const table = tables[callIdx++];
          if (table === 'agent_approvals') {
            return Promise.resolve({ count: 5, error: null });
          }
          return Promise.resolve({
            count: null,
            error: { code: '42P01', message: 'undefined_object' },
          });
        },
      }),
    } as unknown as SupabaseClient;

    const result = await getDashboardSummary(mockClient, workspaceId);

    expect(result.pendingApprovals).toBe(5);
    expect(result.agentActivityCount).toBe(0);
  });
});
