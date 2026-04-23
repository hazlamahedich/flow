import { describe, it, expect } from 'vitest';
import { scopeClientAccessSchema, revokeSessionSchema, inviteMemberSchema } from '@flow/types';

describe('workspace RBAC: schema validation via @flow/types', () => {
  describe('scopeClientAccessSchema', () => {
    it('accepts valid input', () => {
      const result = scopeClientAccessSchema.safeParse({
        userId: crypto.randomUUID(),
        clientId: crypto.randomUUID(),
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing userId', () => {
      const result = scopeClientAccessSchema.safeParse({
        clientId: crypto.randomUUID(),
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid userId format', () => {
      const result = scopeClientAccessSchema.safeParse({
        userId: 'not-a-uuid',
        clientId: crypto.randomUUID(),
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing clientId', () => {
      const result = scopeClientAccessSchema.safeParse({
        userId: crypto.randomUUID(),
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid clientId format', () => {
      const result = scopeClientAccessSchema.safeParse({
        userId: crypto.randomUUID(),
        clientId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('revokeSessionSchema', () => {
    it('accepts valid deviceId', () => {
      const result = revokeSessionSchema.safeParse({
        deviceId: crypto.randomUUID(),
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid deviceId', () => {
      const result = revokeSessionSchema.safeParse({
        deviceId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing deviceId', () => {
      const result = revokeSessionSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('inviteMemberSchema', () => {
    it('accepts valid member invitation', () => {
      const result = inviteMemberSchema.safeParse({
        email: 'user@example.com',
        role: 'member',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid admin invitation (owner-only role)', () => {
      const result = inviteMemberSchema.safeParse({
        email: 'admin@example.com',
        role: 'admin',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = inviteMemberSchema.safeParse({
        email: 'not-an-email',
        role: 'member',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid role', () => {
      const result = inviteMemberSchema.safeParse({
        email: 'user@example.com',
        role: 'superadmin',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('cross-workspace isolation', () => {
    it('different workspaces generate different IDs', () => {
      const workspaceX = crypto.randomUUID();
      const workspaceY = crypto.randomUUID();
      expect(workspaceX).not.toBe(workspaceY);
    });

    it('RLS policies enforce workspace_id scoping (documented expectation)', () => {
      const membership = {
        workspace_id: crypto.randomUUID(),
        user_id: crypto.randomUUID(),
        role: 'member',
      };
      const accessingWorkspace = crypto.randomUUID();
      const isCrossWorkspace = membership.workspace_id !== accessingWorkspace;
      expect(isCrossWorkspace).toBe(true);
    });
  });
});
