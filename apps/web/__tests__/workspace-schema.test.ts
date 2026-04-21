import { describe, it, expect } from 'vitest';
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  updateRoleSchema,
  revokeMemberSchema,
  initiateTransferSchema,
  confirmTransferSchema,
  scopeClientAccessSchema,
  MemberStatusEnum,
  RoleEnum,
} from '@flow/types';

function buildWorkspace(overrides: Record<string, unknown> = {}) {
  const id = (overrides.id as string) ?? crypto.randomUUID();
  const name = (overrides.name as string) ?? `Test Workspace ${id.slice(0, 8)}`;
  return {
    id,
    name,
    slug: (overrides.slug as string) ?? name.toLowerCase().replace(/\s+/g, '-'),
    createdBy: (overrides.createdBy as string | null) ?? null,
    createdAt: (overrides.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (overrides.updatedAt as string) ?? new Date().toISOString(),
    settings: (overrides.settings as Record<string, unknown>) ?? {},
  };
}

function buildMember(overrides: Record<string, unknown> = {}) {
  return {
    id: (overrides.id as string) ?? crypto.randomUUID(),
    workspaceId: (overrides.workspaceId as string) ?? crypto.randomUUID(),
    userId: (overrides.userId as string) ?? crypto.randomUUID(),
    role: (overrides.role as string) ?? 'member',
    status: (overrides.status as string) ?? 'active',
    joinedAt: (overrides.joinedAt as string) ?? new Date().toISOString(),
    expiresAt: (overrides.expiresAt as string | null) ?? null,
    removedAt: (overrides.removedAt as string | null) ?? null,
    updatedAt: (overrides.updatedAt as string) ?? new Date().toISOString(),
  };
}

function buildInvitation(overrides: Record<string, unknown> = {}) {
  const token = crypto.randomUUID().replace(/-/g, '');
  return {
    id: (overrides.id as string) ?? crypto.randomUUID(),
    workspaceId: (overrides.workspaceId as string) ?? crypto.randomUUID(),
    email: (overrides.email as string) ?? `invite-${token.slice(0, 8)}@test.flow.local`,
    role: (overrides.role as string) ?? 'member',
    tokenHash: (overrides.tokenHash as string) ?? token,
    expiresAt: (overrides.expiresAt as string) ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    acceptedAt: (overrides.acceptedAt as string | null) ?? null,
    invitedBy: (overrides.invitedBy as string) ?? crypto.randomUUID(),
    createdAt: (overrides.createdAt as string) ?? new Date().toISOString(),
  };
}

function buildTransferRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: (overrides.id as string) ?? crypto.randomUUID(),
    workspaceId: (overrides.workspaceId as string) ?? crypto.randomUUID(),
    fromUserId: (overrides.fromUserId as string) ?? crypto.randomUUID(),
    toUserId: (overrides.toUserId as string) ?? crypto.randomUUID(),
    status: (overrides.status as string) ?? 'pending',
    createdAt: (overrides.createdAt as string) ?? new Date().toISOString(),
    expiresAt: (overrides.expiresAt as string) ?? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    acceptedAt: (overrides.acceptedAt as string | null) ?? null,
  };
}

describe('workspace-schema', () => {
  describe('Zod schema validation', () => {
    it('createWorkspaceSchema accepts valid input', () => {
      const result = createWorkspaceSchema.safeParse({ name: 'My Agency' });
      expect(result.success).toBe(true);
    });

    it('createWorkspaceSchema rejects empty name', () => {
      const result = createWorkspaceSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('createWorkspaceSchema rejects missing name', () => {
      const result = createWorkspaceSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('createWorkspaceSchema rejects name over 100 chars', () => {
      const result = createWorkspaceSchema.safeParse({ name: 'x'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('inviteMemberSchema accepts admin role', () => {
      const result = inviteMemberSchema.safeParse({
        email: 'test@example.com',
        role: 'admin',
        workspaceId: crypto.randomUUID(),
      });
      expect(result.success).toBe(true);
    });

    it('inviteMemberSchema accepts member role', () => {
      const result = inviteMemberSchema.safeParse({
        email: 'test@example.com',
        role: 'member',
        workspaceId: crypto.randomUUID(),
      });
      expect(result.success).toBe(true);
    });

    it('inviteMemberSchema rejects owner role', () => {
      const result = inviteMemberSchema.safeParse({
        email: 'test@example.com',
        role: 'owner',
        workspaceId: crypto.randomUUID(),
      });
      expect(result.success).toBe(false);
    });

    it('inviteMemberSchema rejects invalid email', () => {
      const result = inviteMemberSchema.safeParse({
        email: 'not-an-email',
        role: 'member',
        workspaceId: crypto.randomUUID(),
      });
      expect(result.success).toBe(false);
    });

    it('updateRoleSchema accepts valid role', () => {
      const result = updateRoleSchema.safeParse({
        memberId: crypto.randomUUID(),
        role: 'admin',
        workspaceId: crypto.randomUUID(),
      });
      expect(result.success).toBe(true);
    });

    it('revokeMemberSchema accepts valid input', () => {
      const result = revokeMemberSchema.safeParse({
        memberId: crypto.randomUUID(),
        workspaceId: crypto.randomUUID(),
      });
      expect(result.success).toBe(true);
    });

    it('initiateTransferSchema accepts valid input', () => {
      const result = initiateTransferSchema.safeParse({
        toUserId: crypto.randomUUID(),
        workspaceId: crypto.randomUUID(),
      });
      expect(result.success).toBe(true);
    });

    it('confirmTransferSchema accepts valid input', () => {
      const result = confirmTransferSchema.safeParse({
        transferId: crypto.randomUUID(),
        workspaceId: crypto.randomUUID(),
      });
      expect(result.success).toBe(true);
    });

    it('scopeClientAccessSchema accepts valid input', () => {
      const result = scopeClientAccessSchema.safeParse({
        userId: crypto.randomUUID(),
        clientId: crypto.randomUUID(),
        workspaceId: crypto.randomUUID(),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Enums', () => {
    it('RoleEnum has correct values', () => {
      expect(RoleEnum.Values).toEqual({
        owner: 'owner',
        admin: 'admin',
        member: 'member',
        client_user: 'client_user',
      });
    });

    it('MemberStatusEnum has correct values', () => {
      expect(MemberStatusEnum.Values).toEqual({
        active: 'active',
        expired: 'expired',
        revoked: 'revoked',
      });
    });
  });

  describe('Fixture factories', () => {
    it('buildWorkspace creates valid workspace', () => {
      const ws = buildWorkspace();
      expect(ws.id).toBeDefined();
      expect(ws.name).toBeDefined();
      expect(ws.slug).toBeDefined();
      expect(ws.createdBy).toBeNull();
      expect(ws.settings).toEqual({});
    });

    it('buildWorkspace applies overrides', () => {
      const id = crypto.randomUUID();
      const ws = buildWorkspace({ id, name: 'Custom' });
      expect(ws.id).toBe(id);
      expect(ws.name).toBe('Custom');
    });

    it('buildMember creates active member by default', () => {
      const member = buildMember();
      expect(member.status).toBe('active');
      expect(member.expiresAt).toBeNull();
      expect(member.role).toBe('member');
    });

    it('buildMember applies overrides', () => {
      const wsId = crypto.randomUUID();
      const member = buildMember({ workspaceId: wsId, role: 'owner', status: 'revoked' });
      expect(member.workspaceId).toBe(wsId);
      expect(member.role).toBe('owner');
      expect(member.status).toBe('revoked');
    });

    it('buildInvitation creates pending invitation with token hash', () => {
      const inv = buildInvitation();
      expect(inv.tokenHash).toBeDefined();
      expect(inv.acceptedAt).toBeNull();
      expect(inv.role).toBe('member');
    });

    it('buildTransferRequest creates pending transfer by default', () => {
      const tr = buildTransferRequest();
      expect(tr.status).toBe('pending');
      expect(tr.acceptedAt).toBeNull();
      expect(tr.fromUserId).not.toBe(tr.toUserId);
    });
  });
});
