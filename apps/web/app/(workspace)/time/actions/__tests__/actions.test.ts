import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string) => ({
    status, code, message, category,
  }),
  createTimeEntry: vi.fn(),
  softDeleteTimeEntry: vi.fn(),
  createProject: vi.fn(),
  ProjectNameDuplicateError: class extends Error { constructor() { super('duplicate'); this.name = 'ProjectNameDuplicateError'; } },
}));

import { createTimeEntryAction } from '../create-time-entry';
import { softDeleteTimeEntryAction } from '../soft-delete-time-entry';
import { createProjectAction } from '../create-project';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createTimeEntry, softDeleteTimeEntry, createProject } from '@flow/db';

const mockSupabase = {};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase as never);
  vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'owner' } as never);
});

describe('createTimeEntryAction', () => {
  it('returns validation error for durationMinutes = 0', async () => {
    const result = await createTimeEntryAction({
      clientId: '00000000-0000-0000-0000-000000000001', projectId: null, date: '2026-05-09', durationMinutes: 0,
    });
    expect(result.success).toBe(false);
  });

  it('returns validation error for durationMinutes = 1441', async () => {
    const result = await createTimeEntryAction({
      clientId: '00000000-0000-0000-0000-000000000001', projectId: null, date: '2026-05-09', durationMinutes: 1441,
    });
    expect(result.success).toBe(false);
  });

  it('returns validation error for missing clientId', async () => {
    const result = await createTimeEntryAction({
      clientId: '', projectId: null, date: '2026-05-09', durationMinutes: 60,
    });
    expect(result.success).toBe(false);
  });

  it('returns created entry on success', async () => {
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'te1', workspaceId: 'ws1', clientId: 'c1', userId: 'u1',
      projectId: null, date: '2026-05-09', durationMinutes: 90,
      notes: null, deletedAt: null, createdAt: '2026-05-09', updatedAt: '2026-05-09',
    } as never);

    const result = await createTimeEntryAction({
      clientId: '00000000-0000-0000-0000-000000000001', projectId: null, date: '2026-05-09', durationMinutes: 90,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('te1');
    }
  });
});

describe('softDeleteTimeEntryAction', () => {
  it('returns success on own entry delete', async () => {
    vi.mocked(softDeleteTimeEntry).mockResolvedValue(true as never);
    const result = await softDeleteTimeEntryAction({ id: '00000000-0000-0000-0000-000000000001' });
    expect(result.success).toBe(true);
  });

  it('returns validation error for invalid id', async () => {
    const result = await softDeleteTimeEntryAction({ id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('createProjectAction', () => {
  it('returns created project on success', async () => {
    vi.mocked(createProject).mockResolvedValue({
      id: 'p1', workspaceId: 'ws1', clientId: 'c1', name: 'Test',
      description: null, status: 'active', archivedAt: null,
      createdAt: '2026-05-09', updatedAt: '2026-05-09',
    } as never);

    const result = await createProjectAction({ clientId: '00000000-0000-0000-0000-000000000001', name: 'Test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Test');
    }
  });

  it('returns CONFLICT error for duplicate project name', async () => {
    const { ProjectNameDuplicateError: Err } = await import('@flow/db');
    vi.mocked(createProject).mockRejectedValue(new Err());

    const result = await createProjectAction({ clientId: '00000000-0000-0000-0000-000000000001', name: 'Duplicate' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFLICT');
    }
  });
});
