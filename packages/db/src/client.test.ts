import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createServerClient,
  createBrowserClient,
  createServiceClient,
} from './client';

describe('createServerClient', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  it('creates a client with cookie store methods', () => {
    const cookieStore = {
      getAll: () => [{ name: 'sb-token', value: 'abc123' }],
      set: vi.fn(),
    };

    const client = createServerClient(cookieStore);
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    expect(() => createServerClient({ getAll: () => [], set: vi.fn() })).toThrow(
      'NEXT_PUBLIC_SUPABASE_URL is not set',
    );
  });

  it('throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    expect(() => createServerClient({ getAll: () => [], set: vi.fn() })).toThrow(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set',
    );
  });
});

describe('createBrowserClient', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  it('creates a browser client', () => {
    const client = createBrowserClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });
});

describe('createServiceClient', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => createServiceClient()).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY is not set',
    );
  });

  it('creates a service client with valid key', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    const client = createServiceClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });
});
