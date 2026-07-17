import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (
    status: number,
    code: string,
    message: string,
    category: string,
  ) => ({
    status,
    code,
    message,
    category,
  }),
  listTimeEntries: vi.fn(),
}));

import { listTimeEntriesAction } from '../list-time-entries';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, listTimeEntries } from '@flow/db';

const mockSupabase = { from: vi.fn() };

const defaultResult = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 25,
  hasNextPage: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase as never);
  vi.mocked(requireTenantContext).mockResolvedValue({
    workspaceId: 'ws-1',
    userId: 'u-1',
    role: 'owner',
  } as never);
  vi.mocked(listTimeEntries).mockResolvedValue(defaultResult as never);
});

describe('listTimeEntriesAction', () => {
  it('[P0] returns validation error for invalid clientId filter', async () => {
    const result = await listTimeEntriesAction({ clientId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns validation error for invalid dateFrom format', async () => {
    const result = await listTimeEntriesAction({ dateFrom: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns validation error for invalid dateTo format', async () => {
    const result = await listTimeEntriesAction({ dateTo: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns validation error for page < 1', async () => {
    const result = await listTimeEntriesAction({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('[P0] returns entries with default page 1 when no filters', async () => {
    vi.mocked(listTimeEntries).mockResolvedValue({
      items: [{ id: 'e1' }],
      total: 1,
      page: 1,
      pageSize: 25,
      hasNextPage: false,
    } as never);

    const result = await listTimeEntriesAction({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(1);
      expect(result.data.page).toBe(1);
    }
  });

  it('[P0] passes all filters to listTimeEntries', async () => {
    const filters = {
      clientId: '00000000-0000-0000-0000-000000000001',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      page: 2,
    };

    await listTimeEntriesAction(filters);

    expect(listTimeEntries).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        workspaceId: 'ws-1',
        userId: 'u-1',
        role: 'owner',
        filters: expect.objectContaining({
          clientId: filters.clientId,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        }),
        page: 2,
      }),
    );
  });

  it('[P0] passes userId filter for member-scoped views', async () => {
    vi.mocked(requireTenantContext).mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'admin',
    } as never);

    await listTimeEntriesAction({
      userId: '00000000-0000-0000-0000-000000000003',
    });

    expect(listTimeEntries).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        filters: expect.objectContaining({
          userId: '00000000-0000-0000-0000-000000000003',
        }),
      }),
    );
  });

  it('[P0] returns INTERNAL_ERROR when listTimeEntries throws', async () => {
    vi.mocked(listTimeEntries).mockRejectedValue(
      new Error('db error') as never,
    );

    const result = await listTimeEntriesAction({});
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INTERNAL_ERROR');
  });

  it('[P1] omits undefined filters from the query', async () => {
    await listTimeEntriesAction({ page: 1 });

    expect(listTimeEntries).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        filters: {},
      }),
    );
  });

  it('[P1] defaults page to 1 when omitted', async () => {
    await listTimeEntriesAction({});

    expect(listTimeEntries).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({ page: 1 }),
    );
  });
});
