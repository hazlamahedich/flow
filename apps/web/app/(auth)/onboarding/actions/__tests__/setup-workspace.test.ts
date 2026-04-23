import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@/lib/workspace-utils', () => ({
  generateSlug: vi.fn(),
  mapWorkspaceRow: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  createFlowError: vi.fn((status, code, message, domain) => ({
    status,
    code,
    message,
    domain,
  })),
  cacheTag: vi.fn((...parts: string[]) => parts.join(':')),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('@flow/types', () => ({
  createWorkspaceSchema: {
    safeParse: vi.fn(),
  },
}));

import { getServerSupabase } from '@/lib/supabase-server';
import { generateSlug, mapWorkspaceRow } from '@/lib/workspace-utils';
import { createFlowError, cacheTag } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { createWorkspaceSchema } from '@flow/types';
import { setupWorkspace } from '../setup-workspace';

function buildMockSupabase(overrides: Record<string, unknown> = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null });
  const eq2 = vi.fn().mockReturnValue({ maybeSingle });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });

  const single = vi.fn().mockResolvedValue({ data: null, error: null });
  const rpc = vi.fn().mockReturnValue({ single });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: vi.fn().mockReturnValue({ select }),
    rpc,
    _maybeSingle: maybeSingle,
    _eq1: eq1,
    _eq2: eq2,
    _select: select,
    _single: single,
    _rpc: rpc,
    ...overrides,
  };
}

describe('setupWorkspace', () => {
  let mockSupabase: ReturnType<typeof buildMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = buildMockSupabase();
    vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(createWorkspaceSchema.safeParse).mockReturnValue({
      success: true,
      data: { name: 'Test Workspace' },
    } as any);
    vi.mocked(generateSlug).mockReturnValue('test-workspace-a1b2c3');
    vi.mocked(mapWorkspaceRow).mockReturnValue({
      id: 'ws-1',
      name: 'Test Workspace',
      slug: 'test-workspace-a1b2c3',
      createdBy: 'user-1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      settings: {},
    });
  });

  it('returns validation error for invalid input', async () => {
    vi.mocked(createWorkspaceSchema.safeParse).mockReturnValue({
      success: false,
      error: { message: 'Name is required' },
    } as any);
    const result = await setupWorkspace({ name: '' });
    expect(result.success).toBe(false);
    expect(createFlowError).toHaveBeenCalledWith(
      400,
      'VALIDATION_ERROR',
      'Name is required',
      'validation',
    );
  });

  it('returns auth error when not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Unauthorized'),
    });
    const result = await setupWorkspace({ name: 'Test' });
    expect(result.success).toBe(false);
    expect(createFlowError).toHaveBeenCalledWith(
      401,
      'AUTH_REQUIRED',
      'Authentication required',
      'auth',
    );
  });

  it('returns conflict when user already has workspace', async () => {
    mockSupabase._maybeSingle.mockResolvedValue({
      data: { workspace_id: 'ws-existing' },
    });
    const result = await setupWorkspace({ name: 'Test' });
    expect(result.success).toBe(false);
    expect(createFlowError).toHaveBeenCalledWith(
      409,
      'CONFLICT',
      'User already has a workspace',
      'system',
    );
  });

  it('returns workspace data on successful creation', async () => {
    const row = { id: 'ws-1', name: 'Test Workspace', slug: 'test-workspace-a1b2c3' };
    mockSupabase._single.mockResolvedValue({ data: row, error: null });
    const result = await setupWorkspace({ name: 'Test Workspace' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      id: 'ws-1',
      name: 'Test Workspace',
      slug: 'test-workspace-a1b2c3',
      createdBy: 'user-1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      settings: {},
    });
    expect(revalidateTag).toHaveBeenCalledTimes(2);
  });

  it('retries on slug collision (23505)', async () => {
    const collisionError = { code: '23505', message: 'duplicate key' };
    const successData = { id: 'ws-2', name: 'Test', slug: 'test-abc123' };
    mockSupabase._single
      .mockResolvedValueOnce({ data: null, error: collisionError })
      .mockResolvedValueOnce({ data: successData, error: null });
    const result = await setupWorkspace({ name: 'Test' });
    expect(result.success).toBe(true);
    expect(generateSlug).toHaveBeenCalledTimes(2);
  });

  it('returns slug collision error after MAX_SLUG_RETRIES', async () => {
    const collisionError = { code: '23505', message: 'duplicate key' };
    mockSupabase._single.mockResolvedValue({ data: null, error: collisionError });
    const result = await setupWorkspace({ name: 'Test' });
    expect(result.success).toBe(false);
    expect(createFlowError).toHaveBeenCalledWith(
      500,
      'WORKSPACE_SLUG_COLLISION',
      expect.stringContaining('Failed to create workspace after 3 attempts'),
      'system',
    );
    expect(generateSlug).toHaveBeenCalledTimes(3);
  });

  it('returns internal error on non-23505 RPC error', async () => {
    mockSupabase._single.mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    });
    const result = await setupWorkspace({ name: 'Test' });
    expect(result.success).toBe(false);
    expect(createFlowError).toHaveBeenCalledWith(
      500,
      'INTERNAL_ERROR',
      'Failed to create workspace',
      'system',
    );
  });
});
