import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string) => ({ status, code, message, category }),
  cacheTag: vi.fn((entity: string, id: string) => `${entity}:${id}`),
  createRetainer: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('../create-client', () => ({
  createWorkspaceClient: vi.fn(),
}));

import { setupClientWizard } from '../setup-client-wizard';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createRetainer } from '@flow/db';
import { createWorkspaceClient } from '../create-client';
import { revalidateTag } from 'next/cache';
import { buildClient, buildRetainer } from '@flow/test-utils';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockRequireTenantContext = vi.mocked(requireTenantContext);
const mockCreateRetainer = vi.mocked(createRetainer);
const mockCreateWorkspaceClient = vi.mocked(createWorkspaceClient);
const mockRevalidateTag = vi.mocked(revalidateTag);

const mockSupabase = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSupabase.mockResolvedValue(mockSupabase);
  mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'owner' });
});

describe('setupClientWizard', () => {
  const mockClient = buildClient({ id: 'client-1', workspaceId: 'ws1' });

  it('creates client only when no retainer data', async () => {
    mockCreateWorkspaceClient.mockResolvedValue({ success: true, data: mockClient });

    const result = await setupClientWizard({ clientData: { name: 'Test' } });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.client).toEqual(mockClient);
      expect(result.data.retainer).toBeUndefined();
      expect(result.data.warning).toBeUndefined();
    }
  });

  it('creates client + retainer on success', async () => {
    const mockRetainer = buildRetainer({ clientId: 'client-1', workspaceId: 'ws1' });
    mockCreateWorkspaceClient.mockResolvedValue({ success: true, data: mockClient });
    mockCreateRetainer.mockResolvedValue(mockRetainer);

    const result = await setupClientWizard({
      clientData: { name: 'Test' },
      retainerData: { type: 'hourly_rate', hourlyRateCents: 5000 },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.client).toEqual(mockClient);
      expect(result.data.retainer).toEqual(mockRetainer);
      expect(result.data.warning).toBeUndefined();
    }
  });

  it('returns partial success when retainer 23505 unique constraint', async () => {
    mockCreateWorkspaceClient.mockResolvedValue({ success: true, data: mockClient });
    const err = new Error('unique violation') as Error & { code: string; retainerCode: string };
    err.code = '23505';
    err.retainerCode = 'RETAINER_ACTIVE_EXISTS';
    mockCreateRetainer.mockRejectedValue(err);

    const result = await setupClientWizard({
      clientData: { name: 'Test' },
      retainerData: { type: 'hourly_rate', hourlyRateCents: 5000 },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warning?.code).toBe('RETAINER_ACTIVE_EXISTS');
    }
  });

  it('returns partial success when retainer Zod failure', async () => {
    mockCreateWorkspaceClient.mockResolvedValue({ success: true, data: mockClient });

    const result = await setupClientWizard({
      clientData: { name: 'Test' },
      retainerData: { type: 'hourly_rate', hourlyRateCents: -1 },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warning?.code).toBe('RETAINER_SETUP_FAILED');
    }
  });

  it('returns partial success on retainer DB error', async () => {
    mockCreateWorkspaceClient.mockResolvedValue({ success: true, data: mockClient });
    const err = new Error('DB error') as Error & { code: string };
    err.code = 'UNKNOWN';
    mockCreateRetainer.mockRejectedValue(err);

    const result = await setupClientWizard({
      clientData: { name: 'Test' },
      retainerData: { type: 'hourly_rate', hourlyRateCents: 5000 },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warning?.code).toBe('RETAINER_SETUP_FAILED');
    }
  });

  it('returns failure when client creation fails', async () => {
    mockCreateWorkspaceClient.mockResolvedValue({
      success: false,
      error: { status: 400, code: 'VALIDATION_ERROR', message: 'Validation failed', category: 'validation' },
    });

    const result = await setupClientWizard({ clientData: { name: '' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(mockCreateRetainer).not.toHaveBeenCalled();
  });

  it('returns failure on tier limit', async () => {
    mockCreateWorkspaceClient.mockResolvedValue({
      success: false,
      error: { status: 403, code: 'CLIENT_LIMIT_REACHED', message: 'Limit reached', category: 'validation' },
    });

    const result = await setupClientWizard({ clientData: { name: 'Test' } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CLIENT_LIMIT_REACHED');
    }
  });

  it('uses success discriminant (not ok)', async () => {
    mockCreateWorkspaceClient.mockResolvedValue({ success: true, data: mockClient });

    const result = await setupClientWizard({ clientData: { name: 'Test' } });

    expect('success' in result).toBe(true);
    expect(result.success).toBe(true);
  });

  it('partial success still has success: true with warning', async () => {
    mockCreateWorkspaceClient.mockResolvedValue({ success: true, data: mockClient });

    const result = await setupClientWizard({
      clientData: { name: 'Test' },
      retainerData: { type: 'invalid_type' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warning).toBeDefined();
    }
  });

  it('revalidates retainer_agreement + dashboard on retainer success', async () => {
    const mockRetainer = buildRetainer({ clientId: 'client-1', workspaceId: 'ws1' });
    mockCreateWorkspaceClient.mockResolvedValue({ success: true, data: mockClient });
    mockCreateRetainer.mockResolvedValue(mockRetainer);

    await setupClientWizard({
      clientData: { name: 'Test' },
      retainerData: { type: 'hourly_rate', hourlyRateCents: 5000 },
    });

    const tags = mockRevalidateTag.mock.calls.map((c) => c[0]);
    expect(tags).toContain('retainer_agreement:ws1');
    expect(tags).toContain('dashboard:ws1');
    expect(tags).not.toContain('workspace_client:ws1');
  });
});
