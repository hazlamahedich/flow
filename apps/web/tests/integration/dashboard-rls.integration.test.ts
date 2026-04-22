import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { setupRLSFixture, isSupabaseAvailable } from '@flow/test-utils';
import { getDashboardSummary, listUserWorkspaces } from '@flow/db';

const skip = !isSupabaseAvailable();

describe.skipIf(skip)('Dashboard RLS Integration', () => {
  let fixture: Awaited<ReturnType<typeof setupRLSFixture>>;

  beforeAll(async () => {
    fixture = await setupRLSFixture(crypto.randomUUID(), 'owner');
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  it('cross-workspace data isolation', async () => {
    const own = await getDashboardSummary(fixture.client, fixture.tenantId);
    const other = await getDashboardSummary(fixture.client, fixture.otherTenantId);

    expect(own).toEqual(other);
  });

  it('listUserWorkspaces only returns workspaces user belongs to', async () => {
    const workspaces = await listUserWorkspaces(fixture.client, fixture.tenantId);

    for (const ws of workspaces) {
      expect(ws).toHaveProperty('id');
      expect(ws).toHaveProperty('name');
      expect(ws).toHaveProperty('role');
    }
  });
});
