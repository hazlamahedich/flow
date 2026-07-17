import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: vi.fn((code, type, msg) => ({ code, type, message: msg })),
  getClientInboxById: vi.fn(),
  clearClientInboxTokens: vi.fn(),
  cacheTag: vi.fn((...args: string[]) => args.join(':')),
}));

vi.mock('@flow/db/vault/inbox-tokens', () => ({
  decryptInboxTokens: vi.fn(),
}));

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/agents/providers', () => ({
  GmailProvider: vi.fn().mockImplementation(() => ({
    stopWatch: vi.fn(),
    revokeToken: vi.fn(),
  })),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { disconnectInbox } from '../disconnect-inbox';
import {
  requireTenantContext,
  createFlowError,
  getClientInboxById,
  clearClientInboxTokens,
} from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { decryptInboxTokens } from '@flow/db/vault/inbox-tokens';

describe('disconnectInbox', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: { oauth_state: null }, error: null }),
      update: vi.fn().mockReturnThis(),
    };
    (getServerSupabase as any).mockResolvedValue(mockSupabase);
    (requireTenantContext as any).mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'owner',
    });
  });

  it('returns validation error for invalid input', async () => {
    const result = await disconnectInbox({
      inboxId: 'not-uuid',
      clientId: 'not-uuid',
    });

    expect(result.success).toBe(false);
  });

  it('returns 403 for member role', async () => {
    (requireTenantContext as any).mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'member',
    });

    const result = await disconnectInbox({
      inboxId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
    });

    expect(result.success).toBe(false);
    expect(createFlowError).toHaveBeenCalledWith(
      403,
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });

  it('returns 404 when inbox not found', async () => {
    (getClientInboxById as any).mockResolvedValue(null);

    const result = await disconnectInbox({
      inboxId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
    });

    expect(result.success).toBe(false);
    expect(createFlowError).toHaveBeenCalledWith(
      404,
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });

  it('returns 403 when inbox belongs to different client', async () => {
    (getClientInboxById as any).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000099',
    });

    const result = await disconnectInbox({
      inboxId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
    });

    expect(result.success).toBe(false);
    expect(createFlowError).toHaveBeenCalledWith(
      403,
      'TENANT_MISMATCH',
      expect.any(String),
      expect.any(String),
    );
  });

  it('clears tokens when inbox exists and belongs to client', async () => {
    (getClientInboxById as any).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
    });
    (clearClientInboxTokens as any).mockResolvedValue(undefined);

    const result = await disconnectInbox({
      inboxId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
    });

    expect(result.success).toBe(true);
    expect(clearClientInboxTokens).toHaveBeenCalled();
  });

  it('returns error when disconnect fails unexpectedly', async () => {
    (getClientInboxById as any).mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
    });
    (clearClientInboxTokens as any).mockRejectedValue(new Error('DB error'));

    const result = await disconnectInbox({
      inboxId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
    });

    expect(result.success).toBe(false);
    expect(createFlowError).toHaveBeenCalledWith(
      500,
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });
});
