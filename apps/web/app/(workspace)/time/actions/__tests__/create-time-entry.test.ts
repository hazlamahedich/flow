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
}));

import { createTimeEntryAction } from '../create-time-entry';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createTimeEntry } from '@flow/db';

const mockFrom = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, single: mockSingle });
const mockSupabase = { from: mockFrom };

const validInput = {
  clientId: '00000000-0000-0000-0000-000000000001',
  projectId: null,
  date: '2026-05-10',
  durationMinutes: 60,
  notes: 'Client call',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase as never);
  vi.mocked(requireTenantContext).mockResolvedValue({
    workspaceId: 'ws-1', userId: 'u-1', role: 'owner',
  } as never);
});

describe('createTimeEntryAction', () => {
  it('[P0] returns validation error for missing clientId', async () => {
    const result = await createTimeEntryAction({ ...validInput, clientId: undefined });
    expect(result.success).toBe(false);
  });

  it('[P0] returns validation error for durationMinutes < 1', async () => {
    const result = await createTimeEntryAction({ ...validInput, durationMinutes: 0 });
    expect(result.success).toBe(false);
  });

  it('[P0] returns validation error for durationMinutes > 1440', async () => {
    const result = await createTimeEntryAction({ ...validInput, durationMinutes: 1441 });
    expect(result.success).toBe(false);
  });

  it('[P0] returns validation error for future date', async () => {
    const result = await createTimeEntryAction({ ...validInput, date: '2099-01-01' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns validation error for invalid date format', async () => {
    const result = await createTimeEntryAction({ ...validInput, date: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns validation error for notes > 500 chars', async () => {
    const result = await createTimeEntryAction({ ...validInput, notes: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('[P0] returns validation error for non-UUID clientId', async () => {
    const result = await createTimeEntryAction({ ...validInput, clientId: 'abc' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns VALIDATION_ERROR when project does not belong to client', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'proj-1', client_id: '00000000-0000-0000-0000-000000000099' },
      error: null,
    });

    const result = await createTimeEntryAction({
      ...validInput,
      projectId: '00000000-0000-0000-0000-000000000002',
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('[P0] returns success with entry id on valid input', async () => {
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'entry-1',
      workspaceId: 'ws-1',
      clientId: validInput.clientId,
      userId: 'u-1',
      projectId: null,
      projectName: null,
      date: validInput.date,
      durationMinutes: validInput.durationMinutes,
      notes: validInput.notes ?? null,
      deletedAt: null,
      createdAt: '2026-05-10T00:00:00Z',
      updatedAt: '2026-05-10T00:00:00Z',
    } as never);

    const result = await createTimeEntryAction(validInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe('entry-1');
  });

  it('[P0] passes correct params to createTimeEntry', async () => {
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'entry-1', workspaceId: 'ws-1', clientId: validInput.clientId,
      userId: 'u-1', projectId: null, projectName: null, date: validInput.date,
      durationMinutes: validInput.durationMinutes, notes: validInput.notes ?? null,
      deletedAt: null, createdAt: '2026-05-10T00:00:00Z', updatedAt: '2026-05-10T00:00:00Z',
    } as never);

    await createTimeEntryAction(validInput);

    expect(createTimeEntry).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        workspaceId: 'ws-1',
        userId: 'u-1',
        clientId: validInput.clientId,
        date: validInput.date,
        durationMinutes: validInput.durationMinutes,
      }),
    );
  });

  it('[P0] returns INTERNAL_ERROR when createTimeEntry throws', async () => {
    vi.mocked(createTimeEntry).mockRejectedValue(new Error('db error') as never);

    const result = await createTimeEntryAction(validInput);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INTERNAL_ERROR');
  });

  it('[P1] accepts input without notes', async () => {
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'entry-1', workspaceId: 'ws-1', clientId: validInput.clientId,
      userId: 'u-1', projectId: null, projectName: null, date: validInput.date,
      durationMinutes: validInput.durationMinutes, notes: null,
      deletedAt: null, createdAt: '2026-05-10T00:00:00Z', updatedAt: '2026-05-10T00:00:00Z',
    } as never);

    const result = await createTimeEntryAction({ ...validInput, notes: undefined });
    expect(result.success).toBe(true);
  });

  it('[P1] allows project belonging to the same client', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'proj-1', client_id: validInput.clientId },
      error: null,
    });
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'entry-1', workspaceId: 'ws-1', clientId: validInput.clientId,
      userId: 'u-1', projectId: 'proj-1', projectName: null, date: validInput.date,
      durationMinutes: validInput.durationMinutes, notes: null,
      deletedAt: null, createdAt: '2026-05-10T00:00:00Z', updatedAt: '2026-05-10T00:00:00Z',
    } as never);

    const result = await createTimeEntryAction({
      ...validInput, projectId: '00000000-0000-0000-0000-000000000002',
    });
    expect(result.success).toBe(true);
  });
});
