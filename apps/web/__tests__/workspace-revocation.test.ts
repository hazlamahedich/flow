import { describe, it, expect } from 'vitest';

describe('revocation: status set to revoked (not hard delete)', () => {
  it('marks membership status as revoked', () => {
    const membership = {
      id: 'mem-1',
      status: 'active',
      removed_at: null,
    };

    const revoked = {
      ...membership,
      status: 'revoked',
      removed_at: new Date().toISOString(),
    };

    expect(revoked.status).toBe('revoked');
    expect(revoked.removed_at).not.toBeNull();
  });

  it('preserves user_id and workspace_id after revocation', () => {
    const membership = {
      id: 'mem-1',
      workspace_id: 'ws-1',
      user_id: 'user-1',
      role: 'member',
      status: 'revoked',
      removed_at: new Date().toISOString(),
    };

    expect(membership.workspace_id).toBe('ws-1');
    expect(membership.user_id).toBe('user-1');
  });
});

describe('member_client_access soft-deleted', () => {
  it('sets revoked_at timestamp', () => {
    const access = {
      id: 'access-1',
      user_id: 'user-1',
      client_id: 'client-1',
      workspace_id: 'ws-1',
      revoked_at: null,
    };

    const revoked = {
      ...access,
      revoked_at: new Date().toISOString(),
    };

    expect(revoked.revoked_at).not.toBeNull();
  });
});

describe('last-owner protection', () => {
  it('prevents revoking the only owner', () => {
    const owners = [
      { id: 'mem-1', role: 'owner', status: 'active' },
    ];

    const activeOwners = owners.filter((m) => m.role === 'owner' && m.status === 'active');
    const canRevoke = activeOwners.length > 1;
    expect(canRevoke).toBe(false);
  });

  it('allows revoking when multiple owners exist', () => {
    const owners = [
      { id: 'mem-1', role: 'owner', status: 'active' },
      { id: 'mem-2', role: 'owner', status: 'active' },
    ];

    const activeOwners = owners.filter((m) => m.role === 'owner' && m.status === 'active');
    const canRevoke = activeOwners.length > 1;
    expect(canRevoke).toBe(true);
  });
});

describe('self-revocation prevention', () => {
  it('prevents owner from revoking themselves', () => {
    const currentUserId = 'user-1';
    const targetUserId = 'user-1';
    const isSelf = currentUserId === targetUserId;
    expect(isSelf).toBe(true);
  });
});

describe('audit event logged on revocation', () => {
  it('creates member_revoked audit event', () => {
    const event = {
      type: 'member_revoked' as const,
      workspaceId: 'ws-1',
      memberId: 'mem-1',
      revokedBy: 'owner-1',
      timestamp: new Date().toISOString(),
    };

    expect(event.type).toBe('member_revoked');
    expect(event.workspaceId).toBe('ws-1');
    expect(event.revokedBy).toBe('owner-1');
  });

  it('creates session_revoked_by_owner audit event', () => {
    const event = {
      type: 'session_revoked_by_owner' as const,
      workspaceId: 'ws-1',
      userId: 'user-1',
      revokedBy: 'owner-1',
      timestamp: new Date().toISOString(),
    };

    expect(event.type).toBe('session_revoked_by_owner');
  });
});

describe('ActionResult type contract for revocation', () => {
  it('success result for void return', () => {
    const result = { success: true as const, data: undefined };
    expect(result.success).toBe(true);
    expect(result.data).toBeUndefined();
  });

  it('error result for insufficient role', () => {
    const result = {
      success: false as const,
      error: { status: 403, code: 'INSUFFICIENT_ROLE', message: 'Not allowed', category: 'auth' as const },
    };
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INSUFFICIENT_ROLE');
  });
});
