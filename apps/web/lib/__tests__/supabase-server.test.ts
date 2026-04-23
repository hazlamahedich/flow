import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@flow/db', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { createServerClient } from '@flow/db';
import { cookies as nextCookies } from 'next/headers';
import { getServerSupabase } from '../supabase-server';

describe('getServerSupabase', () => {
  let mockCookieStore: {
    getAll: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore = {
      getAll: vi.fn(),
      set: vi.fn(),
    };
    vi.mocked(nextCookies).mockResolvedValue(mockCookieStore as unknown as Awaited<ReturnType<typeof nextCookies>>);
    vi.mocked(createServerClient).mockReturnValue({ fake: 'client' } as unknown as ReturnType<typeof createServerClient>);
  });

  it('calls createServerClient with cookie adapter', async () => {
    await getServerSupabase();
    expect(createServerClient).toHaveBeenCalled();
  });

  it('getAll maps cookie objects to name/value pairs', async () => {
    mockCookieStore.getAll.mockReturnValue([
      { name: 'sb-token', value: 'abc123', path: '/' },
      { name: 'other', value: 'xyz', domain: '.flow.app' },
    ]);
    await getServerSupabase();
    const adapter = vi.mocked(createServerClient).mock.calls[0]![0] as {
      getAll: () => Array<{ name: string; value: string }>;
      set: (name: string, value: string, options?: Record<string, unknown>) => void;
    };
    const result = adapter.getAll();
    expect(result).toEqual([
      { name: 'sb-token', value: 'abc123' },
      { name: 'other', value: 'xyz' },
    ]);
  });

  it('set delegates to cookieStore.set with path: /', async () => {
    await getServerSupabase();
    const adapter = vi.mocked(createServerClient).mock.calls[0]![0] as {
      getAll: () => Array<{ name: string; value: string }>;
      set: (name: string, value: string, options?: Record<string, unknown>) => void;
    };
    adapter.set('sb-token', 'abc123', { httpOnly: true });
    expect(mockCookieStore.set).toHaveBeenCalledWith('sb-token', 'abc123', {
      httpOnly: true,
      path: '/',
    });
  });

  it('set swallows errors silently', async () => {
    mockCookieStore.set.mockImplementation(() => {
      throw new Error('read-only context');
    });
    await getServerSupabase();
    const adapter = vi.mocked(createServerClient).mock.calls[0]![0] as {
      getAll: () => Array<{ name: string; value: string }>;
      set: (name: string, value: string, options?: Record<string, unknown>) => void;
    };
    expect(() => adapter.set('sb-token', 'abc123')).not.toThrow();
  });

  it('awaits nextCookies before creating client', async () => {
    let resolved = false;
    vi.mocked(nextCookies).mockImplementation(async () => {
      resolved = true;
      return mockCookieStore as unknown as Awaited<ReturnType<typeof nextCookies>>;
    });
    await getServerSupabase();
    expect(resolved).toBe(true);
    expect(createServerClient).toHaveBeenCalled();
    expect(nextCookies).toHaveBeenCalled();
  });
});
