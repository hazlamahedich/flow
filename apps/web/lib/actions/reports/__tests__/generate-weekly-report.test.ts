import { describe, it, expect, vi } from 'vitest';
import { generateWeeklyReportAction } from '../generate-weekly-report';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return {
    ...actual,
    requireTenantContext: vi.fn(),
    createFlowError: actual.createFlowError,
  };
});

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';

function createMockChain(initialData?: {
  data?: unknown;
  error?: { message: string } | null;
}) {
  let currentData = initialData?.data;
  let currentError: { message: string } | null = initialData?.error ?? null;
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ data: currentData ?? null, error: currentError }),
      ),
    single: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ data: currentData ?? null, error: currentError }),
      ),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };
  return {
    chain,
    setData: (d: unknown) => {
      currentData = d;
    },
    setError: (e: { message: string } | null) => {
      currentError = e;
    },
  };
}

function mockSupabase(rpcResult?: unknown, rpcError?: { message: string }) {
  const { chain, setData, setError } = createMockChain();
  return {
    rpc: vi
      .fn()
      .mockResolvedValue({ data: rpcResult, error: rpcError ?? null }),
    from: vi.fn().mockReturnValue(chain),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'u1',
            app_metadata: { workspace_id: 'ws1', role: 'owner' },
          },
        },
      }),
    },
    _mock: { setData, setError, chain },
  };
}

describe('generateWeeklyReportAction', () => {
  it('rejects invalid date range (start > end)', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(
      mockSupabase() as unknown as Awaited<
        ReturnType<typeof getServerSupabase>
      >,
    );
    vi.mocked(requireTenantContext).mockResolvedValue({
      workspaceId: 'ws1',
      userId: 'u1',
      role: 'owner',
    });

    const result = await generateWeeklyReportAction({
      clientId: 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
      periodStart: '2026-05-25',
      periodEnd: '2026-05-19',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_DATE_RANGE');
    }
  });

  it('rejects date range > 31 days', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(
      mockSupabase() as unknown as Awaited<
        ReturnType<typeof getServerSupabase>
      >,
    );
    vi.mocked(requireTenantContext).mockResolvedValue({
      workspaceId: 'ws1',
      userId: 'u1',
      role: 'owner',
    });

    const result = await generateWeeklyReportAction({
      clientId: 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
      periodStart: '2026-01-01',
      periodEnd: '2026-02-15',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('PERIOD_TOO_LONG');
      expect(result.error.message).toContain('31 days');
    }
  });

  it('blocks member from generating reports', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(
      mockSupabase() as unknown as Awaited<
        ReturnType<typeof getServerSupabase>
      >,
    );
    vi.mocked(requireTenantContext).mockResolvedValue({
      workspaceId: 'ws1',
      userId: 'u1',
      role: 'member',
    });

    const result = await generateWeeklyReportAction({
      clientId: 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.status).toBe(403);
    }
  });
});
