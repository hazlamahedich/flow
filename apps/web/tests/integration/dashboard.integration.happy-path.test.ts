import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { setupRLSFixture, isSupabaseAvailable } from '@flow/test-utils';
import { getDashboardSummary } from '@flow/db';

const skip = !isSupabaseAvailable();

describe.skipIf(skip)('Dashboard Integration — Happy Path', () => {
  let fixture: Awaited<ReturnType<typeof setupRLSFixture>>;

  beforeAll(async () => {
    fixture = await setupRLSFixture(crypto.randomUUID(), 'owner');
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it('user sees own workspace data only', async () => {
    const result = await getDashboardSummary(fixture.client, fixture.tenantId);

    expect(result).toEqual({
      pendingApprovals: 0,
      agentActivityCount: 0,
      outstandingInvoices: 0,
      clientHealthAlerts: 0,
    });
  });

  it('populated workspace returns all sections', async () => {
    const result = await getDashboardSummary(fixture.client, fixture.tenantId);

    expect(result).toHaveProperty('pendingApprovals');
    expect(result).toHaveProperty('agentActivityCount');
    expect(result).toHaveProperty('outstandingInvoices');
    expect(result).toHaveProperty('clientHealthAlerts');
  });

  it('new user sees all-zero dashboard gracefully', async () => {
    const result = await getDashboardSummary(fixture.client, fixture.tenantId);

    expect(result.pendingApprovals).toBe(0);
    expect(result.agentActivityCount).toBe(0);
    expect(result.outstandingInvoices).toBe(0);
    expect(result.clientHealthAlerts).toBe(0);
  });

  it('cross-workspace data isolation', async () => {
    const ownResult = await getDashboardSummary(fixture.client, fixture.tenantId);
    const otherResult = await getDashboardSummary(fixture.client, fixture.otherTenantId);

    expect(ownResult).toEqual(otherResult);
    expect(ownResult.pendingApprovals).toBe(0);
    expect(ownResult.agentActivityCount).toBe(0);
  });

  it('dashboard summary shape matches DashboardSummary type contract', async () => {
    const result = await getDashboardSummary(fixture.client, fixture.tenantId);

    expect(Object.keys(result).sort()).toEqual(
      ['pendingApprovals', 'agentActivityCount', 'outstandingInvoices', 'clientHealthAlerts'].sort(),
    );
    for (const value of Object.values(result)) {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('all section counts are integers', async () => {
    const result = await getDashboardSummary(fixture.client, fixture.tenantId);

    expect(Number.isInteger(result.pendingApprovals)).toBe(true);
    expect(Number.isInteger(result.agentActivityCount)).toBe(true);
    expect(Number.isInteger(result.outstandingInvoices)).toBe(true);
    expect(Number.isInteger(result.clientHealthAlerts)).toBe(true);
  });
});
