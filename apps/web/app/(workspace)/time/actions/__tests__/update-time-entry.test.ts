import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string, details?: Record<string, unknown>) => ({
    status, code, message, category, ...(details ? { details } : {}),
  }),
  getTimeEntryForUpdate: vi.fn(),
  updateTimeEntry: vi.fn(),
  insertEditHistory: vi.fn(),
  defaultInvoiceEditGuard: {
    isInvoiced: vi.fn().mockResolvedValue(false),
  },
}));

import { updateTimeEntryAction } from '../update-time-entry';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  getTimeEntryForUpdate,
  updateTimeEntry,
  insertEditHistory,
  defaultInvoiceEditGuard,
} from '@flow/db';

const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'c1', client_id: '00000000-0000-0000-0000-000000000002' }, error: null });
const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
  eq: mockEq,
  maybeSingle: mockMaybeSingle,
});
const mockSupabase = { from: mockFrom };

const validInput = {
  id: '00000000-0000-0000-0000-000000000001',
  date: '2026-05-10',
  durationMinutes: 90,
  clientId: '00000000-0000-0000-0000-000000000002',
  projectId: null,
  notes: null,
};

const currentEntry = {
  id: '00000000-0000-0000-0000-000000000001',
  date: '2026-05-10',
  durationMinutes: 60,
  clientId: '00000000-0000-0000-0000-000000000002',
  projectId: null,
  notes: null,
  deletedAt: null,
  userId: 'u1',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase as never);
  vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'owner' } as never);
  vi.mocked(defaultInvoiceEditGuard.isInvoiced).mockResolvedValue(false);
  mockFrom.mockReturnValue({
    select: mockSelect.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    maybeSingle: mockMaybeSingle.mockResolvedValue({ data: { id: 'c1', client_id: validInput.clientId }, error: null }),
  });
});

describe('updateTimeEntryAction', () => {
  it('returns validation error for durationMinutes < 1', async () => {
    const result = await updateTimeEntryAction({ ...validInput, durationMinutes: 0 });
    expect(result.success).toBe(false);
  });

  it('returns validation error for durationMinutes > 1440', async () => {
    const result = await updateTimeEntryAction({ ...validInput, durationMinutes: 1441 });
    expect(result.success).toBe(false);
  });

  it('returns validation error for empty date', async () => {
    const result = await updateTimeEntryAction({ ...validInput, date: '' });
    expect(result.success).toBe(false);
  });

  it('returns NOT_FOUND when entry does not exist', async () => {
    vi.mocked(getTimeEntryForUpdate).mockResolvedValue(null as never);
    const result = await updateTimeEntryAction(validInput);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND');
  });

  it('returns NOT_FOUND for deleted entry', async () => {
    vi.mocked(getTimeEntryForUpdate).mockResolvedValue({ ...currentEntry, deletedAt: '2026-05-09' } as never);
    const result = await updateTimeEntryAction(validInput);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND');
  });

  it('returns FORBIDDEN for non-owner member', async () => {
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws1', userId: 'u2', role: 'member' } as never);
    vi.mocked(getTimeEntryForUpdate).mockResolvedValue(currentEntry as never);
    const result = await updateTimeEntryAction(validInput);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('allows admin to update any entry', async () => {
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws1', userId: 'u2', role: 'admin' } as never);
    vi.mocked(getTimeEntryForUpdate).mockResolvedValue(currentEntry as never);
    vi.mocked(updateTimeEntry).mockResolvedValue({ id: 'te1', updatedAt: '2026-05-10' } as never);

    const result = await updateTimeEntryAction(validInput);
    expect(result.success).toBe(true);
  });

  it('returns INVOICED_ENTRY_WARNING when invoiced and not acknowledged', async () => {
    vi.mocked(getTimeEntryForUpdate).mockResolvedValue(currentEntry as never);
    vi.mocked(defaultInvoiceEditGuard.isInvoiced).mockResolvedValue(true);

    const result = await updateTimeEntryAction(validInput);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INVOICED_ENTRY_WARNING');
  });

  it('succeeds when invoiced with acknowledgment', async () => {
    vi.mocked(getTimeEntryForUpdate).mockResolvedValue(currentEntry as never);
    vi.mocked(defaultInvoiceEditGuard.isInvoiced).mockResolvedValue(true);
    vi.mocked(updateTimeEntry).mockResolvedValue({ id: 'te1', updatedAt: '2026-05-10' } as never);

    const result = await updateTimeEntryAction({ ...validInput, invoicedAcknowledged: true });
    expect(result.success).toBe(true);
  });

  it('returns updated id and updatedAt on success', async () => {
    vi.mocked(getTimeEntryForUpdate).mockResolvedValue(currentEntry as never);
    vi.mocked(updateTimeEntry).mockResolvedValue({ id: 'te1', updatedAt: '2026-05-10T12:00:00Z' } as never);

    const result = await updateTimeEntryAction({ ...validInput, durationMinutes: 90 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('te1');
      expect(result.data.updatedAt).toBe('2026-05-10T12:00:00Z');
    }
  });

  it('creates edit history with previous values', async () => {
    vi.mocked(getTimeEntryForUpdate).mockResolvedValue(currentEntry as never);
    vi.mocked(updateTimeEntry).mockResolvedValue({ id: 'te1', updatedAt: '2026-05-10' } as never);

    await updateTimeEntryAction({ ...validInput, durationMinutes: 120 });
    expect(insertEditHistory).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        timeEntryId: validInput.id,
        previousValues: expect.objectContaining({ durationMinutes: 60 }),
      }),
    );
  });

  it('succeeds as no-op when values unchanged', async () => {
    vi.mocked(getTimeEntryForUpdate).mockResolvedValue(currentEntry as never);
    vi.mocked(updateTimeEntry).mockResolvedValue({ id: 'te1', updatedAt: '2026-05-10' } as never);

    const result = await updateTimeEntryAction({
      ...validInput,
      durationMinutes: 60,
      date: '2026-05-10',
    });
    expect(result.success).toBe(true);
    expect(insertEditHistory).not.toHaveBeenCalled();
  });
});
