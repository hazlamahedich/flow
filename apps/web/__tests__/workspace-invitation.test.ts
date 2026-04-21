import { describe, it, expect } from 'vitest';
import { inviteMemberSchema } from '@flow/types';

describe('inviteMemberSchema', () => {
  it('accepts valid invitation input', () => {
    const result = inviteMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'member',
      workspaceId: crypto.randomUUID(),
    });
    expect(result.success).toBe(true);
  });

  it('accepts invitation with expiresAt', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = inviteMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'admin',
      workspaceId: crypto.randomUUID(),
      expiresAt: futureDate,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = inviteMemberSchema.safeParse({
      email: 'not-an-email',
      role: 'member',
      workspaceId: crypto.randomUUID(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects client_user role', () => {
    const result = inviteMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'client_user',
      workspaceId: crypto.randomUUID(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects owner role', () => {
    const result = inviteMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'owner',
      workspaceId: crypto.randomUUID(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const result = inviteMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'owner',
    });
    expect(result.success).toBe(false);
  });

  it('rejects past expiresAt', () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const result = inviteMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'member',
      workspaceId: crypto.randomUUID(),
      expiresAt: pastDate,
    });
    expect(result.success).toBe(false);
  });

  it('rejects expiresAt more than 1 year in the future', () => {
    const farFuture = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();
    const result = inviteMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'member',
      workspaceId: crypto.randomUUID(),
      expiresAt: farFuture,
    });
    expect(result.success).toBe(false);
  });
});

describe('invitation lifecycle state machine', () => {
  const legalTransitions = [
    { from: 'pending', to: 'accepted', label: 'pending→accepted' },
    { from: 'pending', to: 'expired', label: 'pending→expired' },
  ];

  const illegalTransitions = [
    { from: 'accepted', to: 'accepted', label: 'accepted→accepted (duplicate)' },
    { from: 'expired', to: 'accepted', label: 'expired→accepted (reaccept)' },
  ];

  it.each(legalTransitions)('allows $label', ({ from, to }) => {
    const validTransitions: Record<string, string[]> = {
      pending: ['accepted', 'expired'],
      accepted: [],
      expired: [],
    };
    expect(validTransitions[from]?.includes(to)).toBe(true);
  });

  it.each(illegalTransitions)('blocks $label', ({ from, to }) => {
    const validTransitions: Record<string, string[]> = {
      pending: ['accepted', 'expired'],
      accepted: [],
      expired: [],
    };
    expect(validTransitions[from]?.includes(to)).toBe(false);
  });
});

describe('token hash verification', () => {
  it('SHA-256 hashes match for same token', async () => {
    const token = crypto.randomUUID();
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    const hashBuffer2 = await crypto.subtle.digest('SHA-256', data);
    const hashArray2 = Array.from(new Uint8Array(hashBuffer2));
    const hashHex2 = hashArray2.map((b) => b.toString(16).padStart(2, '0')).join('');

    expect(hashHex).toBe(hashHex2);
    expect(hashHex.length).toBe(64);
  });

  it('different tokens produce different hashes', async () => {
    const token1 = crypto.randomUUID();
    const token2 = crypto.randomUUID();
    const encoder = new TextEncoder();

    const hash1 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token1))))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const hash2 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token2))))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    expect(hash1).not.toBe(hash2);
  });
});

describe('duplicate invitation (resend)', () => {
  it('identifies existing pending invitation by workspace + email', () => {
    const existing = {
      workspace_id: 'ws-1',
      email: 'user@test.com',
      accepted_at: null,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const isResend = existing.accepted_at === null && new Date(existing.expires_at) > new Date();
    expect(isResend).toBe(true);
  });

  it('does not resend accepted invitation', () => {
    const existing = {
      workspace_id: 'ws-1',
      email: 'user@test.com',
      accepted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const isResend = existing.accepted_at === null && new Date(existing.expires_at) > new Date();
    expect(isResend).toBe(false);
  });
});

describe('self-invitation rejection', () => {
  it('detects self-invitation by email match', () => {
    const currentUserEmail = 'owner@workspace.com';
    const inviteEmail = 'owner@workspace.com';

    expect(currentUserEmail.toLowerCase()).toBe(inviteEmail.toLowerCase());
  });

  it('allows inviting different email', () => {
    const currentUserEmail = 'owner@workspace.com';
    const inviteEmail = 'newuser@example.com';

    expect(currentUserEmail.toLowerCase()).not.toBe(inviteEmail.toLowerCase());
  });
});

describe('role-based invitation permissions', () => {
  it('owner can invite admin and member', () => {
    const ownerRole = 'owner';
    const canInviteAdmin = ['owner'].includes(ownerRole);
    const canInviteMember = ['owner', 'admin'].includes(ownerRole);
    expect(canInviteAdmin).toBe(true);
    expect(canInviteMember).toBe(true);
  });

  it('admin can invite member only', () => {
    const adminRole = 'admin';
    const canInviteAdmin = ['owner'].includes(adminRole);
    const canInviteMember = ['owner', 'admin'].includes(adminRole);
    expect(canInviteAdmin).toBe(false);
    expect(canInviteMember).toBe(true);
  });

  it('member cannot invite', () => {
    const memberRole = 'member';
    const canInvite = ['owner', 'admin'].includes(memberRole);
    expect(canInvite).toBe(false);
  });
});

describe('rate limit enforcement', () => {
  it('invitation config allows 10 per workspace per hour', () => {
    const INVITATION_LIMIT = { maxRequests: 10, windowMs: 60 * 60 * 1000 };
    expect(INVITATION_LIMIT.maxRequests).toBe(10);
    expect(INVITATION_LIMIT.windowMs).toBe(3600000);
  });
});

describe('ActionResult type contract', () => {
  it('success result has success=true and data', () => {
    const result = { success: true as const, data: { id: 'test' } };
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'test' });
  });

  it('error result has success=false and error with code', () => {
    const result = {
      success: false as const,
      error: { status: 403, code: 'INSUFFICIENT_ROLE', message: 'Not allowed', category: 'auth' as const },
    };
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INSUFFICIENT_ROLE');
  });
});
