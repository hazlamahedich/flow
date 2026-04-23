import { describe, it, expect } from 'vitest';
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  updateRoleSchema,
  revokeMemberSchema,
  initiateTransferSchema,
  confirmTransferSchema,
  scopeClientAccessSchema,
  revokeSessionSchema,
  workspaceSchema,
  workspaceMemberSchema,
  workspaceInvitationSchema,
  transferRequestSchema,
  RoleEnum,
  MemberStatusEnum,
  TransferStatusEnum,
  InvitationRoleEnum,
} from './workspace';

describe('RoleEnum', () => {
  it('[P0] accepts valid roles', () => {
    expect(RoleEnum.parse('owner')).toBe('owner');
    expect(RoleEnum.parse('admin')).toBe('admin');
    expect(RoleEnum.parse('member')).toBe('member');
    expect(RoleEnum.parse('client_user')).toBe('client_user');
  });

  it('[P0] rejects invalid role', () => {
    expect(() => RoleEnum.parse('superadmin')).toThrow();
  });
});

describe('createWorkspaceSchema', () => {
  it('[P0] accepts valid workspace name', () => {
    const result = createWorkspaceSchema.parse({ name: 'My Workspace' });
    expect(result.name).toBe('My Workspace');
  });

  it('[P0] rejects empty name', () => {
    expect(() => createWorkspaceSchema.parse({ name: '' })).toThrow();
  });

  it('[P0] rejects name over 100 chars', () => {
    expect(() => createWorkspaceSchema.parse({ name: 'x'.repeat(101) })).toThrow();
  });
});

describe('inviteMemberSchema', () => {
  it('[P0] accepts valid invitation', () => {
    const result = inviteMemberSchema.parse({
      email: 'test@example.com',
      role: 'admin',
    });
    expect(result.email).toBe('test@example.com');
    expect(result.role).toBe('admin');
  });

  it('[P0] rejects invalid email', () => {
    expect(() => inviteMemberSchema.parse({ email: 'not-email', role: 'member' })).toThrow();
  });

  it('[P0] rejects owner role (not in InvitationRoleEnum)', () => {
    expect(() => inviteMemberSchema.parse({ email: 'a@b.com', role: 'owner' })).toThrow();
  });

  it('[P0] accepts future expiry date', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = inviteMemberSchema.parse({
      email: 'a@b.com',
      role: 'member',
      expiresAt: futureDate,
    });
    expect(result.expiresAt).toBe(futureDate);
  });

  it('[P0] rejects past expiry date', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    expect(() =>
      inviteMemberSchema.parse({ email: 'a@b.com', role: 'member', expiresAt: pastDate }),
    ).toThrow();
  });

  it('[P0] rejects expiry more than 1 year in future', () => {
    const farFuture = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();
    expect(() =>
      inviteMemberSchema.parse({ email: 'a@b.com', role: 'member', expiresAt: farFuture }),
    ).toThrow();
  });
});

describe('updateRoleSchema', () => {
  it('[P0] accepts valid input', () => {
    const result = updateRoleSchema.parse({ memberId: crypto.randomUUID(), role: 'admin' });
    expect(result.role).toBe('admin');
  });

  it('[P0] rejects non-UUID memberId', () => {
    expect(() => updateRoleSchema.parse({ memberId: 'not-uuid', role: 'admin' })).toThrow();
  });
});

describe('revokeMemberSchema', () => {
  it('[P0] accepts valid UUID memberId', () => {
    const memberId = crypto.randomUUID();
    const result = revokeMemberSchema.parse({ memberId });
    expect(result.memberId).toBe(memberId);
  });
});

describe('initiateTransferSchema', () => {
  it('[P0] accepts valid toUserId', () => {
    const toUserId = crypto.randomUUID();
    const result = initiateTransferSchema.parse({ toUserId });
    expect(result.toUserId).toBe(toUserId);
  });

  it('[P0] rejects non-UUID toUserId', () => {
    expect(() => initiateTransferSchema.parse({ toUserId: 'abc' })).toThrow();
  });
});

describe('confirmTransferSchema', () => {
  it('[P0] accepts valid transferId', () => {
    const transferId = crypto.randomUUID();
    const result = confirmTransferSchema.parse({ transferId });
    expect(result.transferId).toBe(transferId);
  });
});

describe('scopeClientAccessSchema', () => {
  it('[P0] accepts valid UUIDs', () => {
    const userId = crypto.randomUUID();
    const clientId = crypto.randomUUID();
    const result = scopeClientAccessSchema.parse({ userId, clientId });
    expect(result.userId).toBe(userId);
  });
});

describe('revokeSessionSchema', () => {
  it('[P0] accepts valid device UUID', () => {
    const deviceId = crypto.randomUUID();
    const result = revokeSessionSchema.parse({ deviceId });
    expect(result.deviceId).toBe(deviceId);
  });
});

describe('workspaceSchema', () => {
  it('[P0] parses a complete workspace object', () => {
    const ws = {
      id: crypto.randomUUID(),
      name: 'Test Workspace',
      slug: 'test-workspace',
      createdBy: crypto.randomUUID(),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      settings: { theme: 'dark' },
    };
    expect(workspaceSchema.parse(ws)).toEqual(ws);
  });

  it('[P0] accepts null createdBy', () => {
    const ws = {
      id: crypto.randomUUID(),
      name: 'Test',
      slug: 'test',
      createdBy: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      settings: {},
    };
    expect(workspaceSchema.parse(ws).createdBy).toBeNull();
  });
});

describe('workspaceMemberSchema', () => {
  it('[P0] parses a complete member object', () => {
    const member = {
      id: crypto.randomUUID(),
      workspaceId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      role: 'admin',
      status: 'active',
      joinedAt: '2024-01-01T00:00:00Z',
      expiresAt: null,
      removedAt: null,
      updatedAt: '2024-01-01T00:00:00Z',
    };
    expect(workspaceMemberSchema.parse(member)).toEqual(member);
  });
});

describe('MemberStatusEnum', () => {
  it('[P0] accepts all valid statuses', () => {
    ['active', 'expired', 'revoked'].forEach((s) => {
      expect(MemberStatusEnum.parse(s)).toBe(s);
    });
  });
});

describe('TransferStatusEnum', () => {
  it('[P0] accepts all valid statuses', () => {
    ['pending', 'accepted', 'expired', 'cancelled'].forEach((s) => {
      expect(TransferStatusEnum.parse(s)).toBe(s);
    });
  });
});
