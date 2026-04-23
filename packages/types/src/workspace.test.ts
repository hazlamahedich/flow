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
    const result = updateRoleSchema.parse({ memberId: '550e8400-e29b-41d4-a716-446655440000', role: 'admin' });
    expect(result.role).toBe('admin');
  });

  it('[P0] rejects non-UUID memberId', () => {
    expect(() => updateRoleSchema.parse({ memberId: 'not-uuid', role: 'admin' })).toThrow();
  });
});

describe('revokeMemberSchema', () => {
  it('[P0] accepts valid UUID memberId', () => {
    const result = revokeMemberSchema.parse({ memberId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.memberId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('initiateTransferSchema', () => {
  it('[P0] accepts valid toUserId', () => {
    const result = initiateTransferSchema.parse({ toUserId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.toUserId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('[P0] rejects non-UUID toUserId', () => {
    expect(() => initiateTransferSchema.parse({ toUserId: 'abc' })).toThrow();
  });
});

describe('confirmTransferSchema', () => {
  it('[P0] accepts valid transferId', () => {
    const result = confirmTransferSchema.parse({ transferId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.transferId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('scopeClientAccessSchema', () => {
  it('[P0] accepts valid UUIDs', () => {
    const result = scopeClientAccessSchema.parse({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      clientId: '660e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('revokeSessionSchema', () => {
  it('[P0] accepts valid device UUID', () => {
    const result = revokeSessionSchema.parse({ deviceId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.deviceId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('workspaceSchema', () => {
  it('[P0] parses a complete workspace object', () => {
    const ws = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Workspace',
      slug: 'test-workspace',
      createdBy: '550e8400-e29b-41d4-a716-446655440001',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      settings: { theme: 'dark' },
    };
    expect(workspaceSchema.parse(ws)).toEqual(ws);
  });

  it('[P0] accepts null createdBy', () => {
    const ws = {
      id: '550e8400-e29b-41d4-a716-446655440000',
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
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '550e8400-e29b-41d4-a716-446655440002',
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
