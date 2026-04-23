import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateAuthEnv } from '../env';

describe('validateAuthEnv', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    vi.stubEnv('VERCEL_URL', 'my-app.vercel.app');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns AuthEnv when all env vars present', () => {
    const result = validateAuthEnv();

    expect(result).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key',
      supabaseServiceRoleKey: 'service-role-key',
      appUrl: 'https://my-app.vercel.app',
    });
  });

  it('lists all missing env vars in error message', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    expect(() => validateAuthEnv()).toThrow(
      'Missing required auth environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY',
    );
  });

  it('throws for invalid SUPABASE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not-a-url');

    expect(() => validateAuthEnv()).toThrow(
      'NEXT_PUBLIC_SUPABASE_URL is not a valid URL',
    );
  });

  it('falls back to VERCEL_URL when NEXT_PUBLIC_APP_URL absent', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    vi.stubEnv('VERCEL_URL', 'my-app.vercel.app');

    const result = validateAuthEnv();

    expect(result.appUrl).toBe('https://my-app.vercel.app');
  });

  it('defaults to localhost:3000 when neither APP_URL nor VERCEL_URL set', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;

    const result = validateAuthEnv();

    expect(result.appUrl).toBe('http://localhost:3000');
  });
});
