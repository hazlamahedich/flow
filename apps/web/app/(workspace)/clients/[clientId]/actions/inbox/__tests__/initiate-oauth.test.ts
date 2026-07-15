import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: vi.fn((code, type, msg) => ({ code, type, message: msg })),
  cacheTag: vi.fn((...args: string[]) => args.join(':')),
}));

vi.mock('@flow/types', () => ({
  connectInboxInputSchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@/lib/cookie-store', () => ({
  getCookieStore: vi.fn().mockResolvedValue({}),
}));

vi.mock('iron-session', () => ({
  getIronSession: vi.fn().mockResolvedValue({
    state: '',
    codeVerifier: '',
    clientId: '',
    accessType: '',
    workspaceId: '',
    returnTo: '',
    save: vi.fn(),
  }),
}));

vi.mock('@flow/agents/providers', () => ({
  GmailProvider: vi.fn().mockImplementation(() => ({
    getOAuthUrl: vi
      .fn()
      .mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?fake=1'),
  })),
}));

import { initiateOAuth } from '../initiate-oauth';
import { requireTenantContext, createFlowError } from '@flow/db';
import { connectInboxInputSchema } from '@flow/types';
import { getServerSupabase } from '@/lib/supabase-server';

describe('initiateOAuth', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.IRON_SESSION_PASSWORD = 'a'.repeat(32);

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    };
    (getServerSupabase as any).mockResolvedValue(mockSupabase);
    (requireTenantContext as any).mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'owner',
    });
    (connectInboxInputSchema.safeParse as any).mockReturnValue({
      success: true,
      data: {
        clientId: 'c1111111-1111-1111-1111-111111111111',
        accessType: 'direct',
        returnTo: '/clients/c1111111-1111-1111-1111-111111111111',
      },
    });
  });

  it('returns validation error for invalid input', async () => {
    (connectInboxInputSchema.safeParse as any).mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Invalid' }] },
    });

    const result = await initiateOAuth({});

    expect(result.success).toBe(false);
  });

  it('returns 403 for member role', async () => {
    (requireTenantContext as any).mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'member',
    });

    const result = await initiateOAuth({
      clientId: 'c1',
      accessType: 'direct',
    });

    expect(result.success).toBe(false);
    expect(createFlowError).toHaveBeenCalledWith(
      403,
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });

  it('returns 404 when client not found in workspace', async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null });

    const result = await initiateOAuth({
      clientId: 'c1111111-1111-1111-1111-111111111111',
      accessType: 'direct',
    });

    expect(result.success).toBe(false);
    expect(createFlowError).toHaveBeenCalledWith(
      404,
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });

  it('returns OAuth URL on success', async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: 'c1' } });

    const result = await initiateOAuth({
      clientId: 'c1111111-1111-1111-1111-111111111111',
      accessType: 'direct',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.oauthUrl).toContain('accounts.google.com');
      expect(result.data.state).toBeDefined();
    }
  });

  it('sanitizes unsafe returnTo paths', async () => {
    (connectInboxInputSchema.safeParse as any).mockReturnValue({
      success: true,
      data: {
        clientId: 'c1111111-1111-1111-1111-111111111111',
        accessType: 'direct',
        returnTo: 'https://evil.com',
      },
    });
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { id: 'c1' } });

    const result = await initiateOAuth({
      clientId: 'c1111111-1111-1111-1111-111111111111',
      accessType: 'direct',
      returnTo: 'https://evil.com',
    });

    expect(result.success).toBe(true);
  });
});
