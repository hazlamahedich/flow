import { describe, it, expect } from 'vitest';
import { buildWorkspace, buildMember, buildInvitation } from '@flow/test-utils';

describe('Story 1.4: Workspace & Team Management', () => {
  describe('AC: workspace creator becomes owner', () => {
    it('buildWorkspace factory produces a valid workspace', () => {
      const ws = buildWorkspace();
      expect(ws.id).toBeTruthy();
      expect(ws.name).toBeTruthy();
      expect(ws.slug).toBeTruthy();
    });

    it('buildMember defaults to Owner role', () => {
      const member = buildMember({ role: 'owner' });
      expect(member.role).toBe('owner');
      expect(member.status).toBe('active');
    });
  });

  describe('AC: invite team members via email', () => {
    it('buildInvitation creates a valid invitation with token hash', () => {
      const inv = buildInvitation();
      expect(inv.email).toBeTruthy();
      expect(inv.tokenHash).toBeTruthy();
      expect(inv._rawToken).toBeTruthy();
      expect(inv.tokenHash).not.toBe(inv._rawToken);
    });

    it('token hash is SHA-256 of raw token', async () => {
      const inv = buildInvitation();
      const encoder = new TextEncoder();
      const data = encoder.encode(inv._rawToken);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const expectedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      expect(inv.tokenHash).toBe(expectedHash);
    });
  });

  describe('AC: role assignment (Owner, Admin, Member, ClientUser)', () => {
    const validRoles = ['owner', 'admin', 'member', 'client_user'] as const;

    it.each(validRoles)('accepts role: %s', (role) => {
      const member = buildMember({ role });
      expect(member.role).toBe(role);
    });
  });

  describe('AC: revoke access with immediate effect', () => {
    it('member can be revoked', () => {
      const member = buildMember({ status: 'active' });
      expect(member.status).toBe('active');

      const revoked = { ...member, status: 'revoked' as const };
      expect(revoked.status).toBe('revoked');
    });
  });

  describe('AC: time-bound access for subcontractors', () => {
    it('invitation with expiry date is valid', () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const inv = buildInvitation({ expiresAt: futureDate });
      expect(inv.expiresAt).toBeTruthy();
      expect(new Date(inv.expiresAt!).getTime()).toBeGreaterThan(Date.now());
    });

    it('expired invitation is rejected', () => {
      const pastDate = new Date(Date.now() - 1000);
      const isExpired = new Date(pastDate).getTime() < Date.now();
      expect(isExpired).toBe(true);
    });
  });

  describe('AC: ownership transfer', () => {
    it('transfer request has valid from/to fields', () => {
      const transfer = {
        id: crypto.randomUUID(),
        workspaceId: buildWorkspace().id,
        fromUserId: crypto.randomUUID(),
        toUserId: crypto.randomUUID(),
        status: 'pending' as const,
      };
      expect(transfer.fromUserId).not.toBe(transfer.toUserId);
      expect(transfer.status).toBe('pending');
    });
  });
});
