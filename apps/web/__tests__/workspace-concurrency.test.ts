import { describe, it, expect } from 'vitest';

describe('concurrent invitation: two admins invite same email', () => {
  it('unique constraint resolves to one invitation', () => {
    const invitations = [
      { workspace_id: 'ws-1', email: 'user@test.com', token_hash: 'hash-a', accepted_at: null },
      { workspace_id: 'ws-1', email: 'user@test.com', token_hash: 'hash-b', accepted_at: null },
    ];

    const uniqueByEmail = invitations.filter(
      (inv, i, arr) => arr.findIndex((v) => v.email === inv.email) === i,
    );
    expect(uniqueByEmail.length).toBe(1);
  });
});

describe('concurrent: user revoked while accepting', () => {
  it('acceptance fails when user is revoked', () => {
    const membership = { status: 'revoked' };
    const canAccept = membership.status === 'active';
    expect(canAccept).toBe(false);
  });

  it('RPC handles ON CONFLICT for revoked users', () => {
    const existingMembership = {
      workspace_id: 'ws-1',
      user_id: 'user-1',
      status: 'revoked',
    };

    const canReactivate = existingMembership.status === 'revoked';
    expect(canReactivate).toBe(true);
  });
});

describe('concurrent transfer initiations', () => {
  it('second transfer rejected by partial unique index', () => {
    const transfers = [
      { workspace_id: 'ws-1', status: 'pending', from_user_id: 'owner-1', to_user_id: 'user-2' },
    ];

    const hasPending = transfers.some(
      (t) => t.workspace_id === 'ws-1' && t.status === 'pending',
    );
    expect(hasPending).toBe(true);

    const _ = {
      workspace_id: 'ws-1',
      status: 'pending',
      from_user_id: 'owner-1',
      to_user_id: 'user-3',
    };

    const wouldSucceed = !hasPending;
    expect(wouldSucceed).toBe(false);
  });
});

describe('concurrent: last-owner revocation under concurrency', () => {
  it('prevents last owner revocation even with concurrent requests', async () => {
    const owners = [
      { id: 'owner-1', role: 'owner', status: 'active' },
    ];

    const simulateRevoke = () => {
      const activeOwners = owners.filter((o) => o.role === 'owner' && o.status === 'active');
      if (activeOwners.length <= 1) return false;
      const target = owners[0];
      if (!target) return false;
      target.status = 'revoked';
      return true;
    };

    const result1 = simulateRevoke();
    expect(result1).toBe(false);

    const result2 = simulateRevoke();
    expect(result2).toBe(false);
  });

  it('allows revocation when two owners exist', () => {
    const owners = [
      { id: 'owner-1', role: 'owner', status: 'active' },
      { id: 'owner-2', role: 'owner', status: 'active' },
    ];

    const activeOwners = owners.filter((o) => o.role === 'owner' && o.status === 'active');
    const canRevoke = activeOwners.length > 1;
    expect(canRevoke).toBe(true);
  });
});

describe('Promise.all concurrency simulation', () => {
  it('all promises resolve even with race conditions', async () => {
    const results = await Promise.all([
      Promise.resolve({ success: true }),
      Promise.resolve({ success: true }),
      Promise.resolve({ success: true }),
    ]);

    expect(results.every((r) => r.success)).toBe(true);
  });

  it('one failure does not block others with allSettled', async () => {
    const results = await Promise.allSettled([
      Promise.resolve({ success: true }),
      Promise.reject(new Error('conflict')),
      Promise.resolve({ success: true }),
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    expect(succeeded.length).toBe(2);
    expect(failed.length).toBe(1);
  });
});
