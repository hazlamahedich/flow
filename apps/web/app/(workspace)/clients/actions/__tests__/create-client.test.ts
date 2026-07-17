import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@/lib/actions/billing/enforce-tier-limit', () => ({
  enforceTierLimit: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (
    status: number,
    code: string,
    message: string,
    category: string,
  ) => ({ status, code, message, category }),
  cacheTag: vi.fn((entity: string, id: string) => `${entity}:${id}`),
  insertClient: vi.fn(),
  checkDuplicateEmail: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { createWorkspaceClient } from '../create-client';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  insertClient,
  checkDuplicateEmail,
} from '@flow/db';
import { enforceTierLimit } from '@/lib/actions/billing/enforce-tier-limit';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockRequireTenantContext = vi.mocked(requireTenantContext);
const mockInsertClient = vi.mocked(insertClient);
const mockCheckDuplicateEmail = vi.mocked(checkDuplicateEmail);
const mockEnforceTierLimit = vi.mocked(enforceTierLimit);

const mockSupabase = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSupabase.mockResolvedValue(mockSupabase);
  mockRequireTenantContext.mockResolvedValue({
    workspaceId: 'ws1',
    userId: 'u1',
    role: 'owner',
  });
  mockEnforceTierLimit.mockResolvedValue({ allowed: true });
  mockCheckDuplicateEmail.mockResolvedValue(null);
});

describe('createWorkspaceClient', () => {
  it('creates client with valid input', async () => {
    const mockClient = { id: 'c1', name: 'Test', status: 'active' };
    mockInsertClient.mockResolvedValue(mockClient as never);

    const result = await createWorkspaceClient({ name: 'Test Client' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Test');
  });

  it('rejects invalid input', async () => {
    const result = await createWorkspaceClient({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects members from creating clients', async () => {
    mockRequireTenantContext.mockResolvedValue({
      workspaceId: 'ws1',
      userId: 'u1',
      role: 'member',
    });
    const result = await createWorkspaceClient({ name: 'Test' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('blocks when tier limit reached (TIER_LIMIT_EXCEEDED)', async () => {
    mockEnforceTierLimit.mockResolvedValue({
      allowed: false,
      limit: 3,
      current: 3,
      tier: 'free',
    });
    const result = await createWorkspaceClient({ name: 'Test' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('TIER_LIMIT_EXCEEDED');
  });

  it('blocks duplicate email', async () => {
    mockCheckDuplicateEmail.mockResolvedValue({
      id: 'c0',
      name: 'Existing',
      status: 'active',
    } as never);
    const result = await createWorkspaceClient({
      name: 'Test',
      email: 'dup@example.com',
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe('CLIENT_DUPLICATE_EMAIL');
  });
});
