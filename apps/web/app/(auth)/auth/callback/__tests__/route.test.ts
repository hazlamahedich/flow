import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@/lib/auth-audit', () => ({
  logAuthEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
  MAGIC_LINK_VERIFICATION_CONFIG: { maxAttempts: 5, windowMs: 3600000 },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn((key: string) => {
      if (key === 'x-forwarded-for') return '127.0.0.1';
      if (key === 'user-agent') return 'Test/1.0';
      return null;
    }),
  }),
}));

vi.mock('@flow/auth/device-trust', () => ({
  trustDevice: vi.fn().mockResolvedValue({ trusted: true, deviceToken: 'dt-1', deviceId: 'dev-1' }),
}));

vi.mock('@flow/auth/device-types', () => ({
  DEVICE_COOKIE_NAME: 'flow_device',
  DEVICE_PENDING_COOKIE_NAME: 'flow_device_pending',
  DEVICE_COOKIE_MAX_AGE: 2592000,
}));

import { GET } from '../route';
import { getServerSupabase } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAuthEvent } from '@/lib/auth-audit';
import { NextRequest } from 'next/server';

function mockSupabase(authOverrides: Record<string, unknown> = {}) {
  const mock = {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'error' },
      }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      ...authOverrides,
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({ data: [{ workspace_id: 'ws-1' }], error: null }),
        }),
      }),
    }),
  };

  vi.mocked(getServerSupabase).mockResolvedValue(mock as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
  return mock;
}

function createRequest(url: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(url, 'http://localhost:3000'));
  for (const [key, value] of Object.entries(cookies)) {
    req.cookies.set(key, value);
  }
  return req;
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P0] redirects to login with access_denied error', async () => {
    const req = createRequest('http://localhost:3000/auth/callback?error=access_denied&email=test@test.com');
    const response = await GET(req);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('error=access_denied');
  });

  it('[P0] redirects to login with invalid_request when no code', async () => {
    const req = createRequest('http://localhost:3000/auth/callback');
    const response = await GET(req);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('error=invalid_request');
  });

  it('[P0] redirects to login when rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, retryAfterMs: 60000 });
    mockSupabase();

    const req = createRequest('http://localhost:3000/auth/callback?code=abc');
    const response = await GET(req);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('error=rate_limited');
  });

  it('[P0] redirects to onboarding for first login user with no workspaces', async () => {
    mockSupabase({
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-1',
            email: 'new@test.com',
            user_metadata: { is_first_login: true },
          },
        },
        error: null,
      }),
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    const supabase = await getServerSupabase();
    Object.assign(supabase, { from: mockFrom });

    const req = createRequest('http://localhost:3000/auth/callback?code=abc');
    const response = await GET(req);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/onboarding');
    expect(logAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'magic_link_verified', outcome: 'success' }),
    );
  });

  it('[P0] redirects to workspace-picker when user has multiple workspaces', async () => {
    mockSupabase({
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-1',
            email: 'user@test.com',
            user_metadata: { is_first_login: false },
          },
        },
        error: null,
      }),
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({
            data: [{ workspace_id: 'ws-1' }, { workspace_id: 'ws-2' }],
            error: null,
          }),
        }),
      }),
    });
    const supabase = await getServerSupabase();
    Object.assign(supabase, { from: mockFrom });

    const req = createRequest('http://localhost:3000/auth/callback?code=abc');
    const response = await GET(req);

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/workspace-picker');
  });

  it('[P0] clears pending device cookie on callback', async () => {
    mockSupabase({
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1', email: 'u@t.com', user_metadata: {} } },
        error: null,
      }),
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({ data: [{ workspace_id: 'ws-1' }], error: null }),
        }),
      }),
    });
    const supabase = await getServerSupabase();
    Object.assign(supabase, { from: mockFrom });

    const req = createRequest('http://localhost:3000/auth/callback?code=abc', {
      flow_device_pending: 'pending-token',
    });
    const response = await GET(req);

    const setCookieHeader = response.headers.get('set-cookie') ?? '';
    expect(setCookieHeader).toContain('flow_device_pending');
    expect(setCookieHeader).toContain('Max-Age=0');
  });
});
