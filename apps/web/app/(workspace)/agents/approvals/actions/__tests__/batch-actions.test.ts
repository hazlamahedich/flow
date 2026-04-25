import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetServerSupabase = vi.fn().mockResolvedValue({
  from: vi.fn(),
  auth: { getUser: vi.fn() },
});
const mockRequireTenantContext = vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: () => mockGetServerSupabase(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: () => mockRequireTenantContext(),
  createFlowError: (status: number, code: string, message: string, category: string) => ({
    status, code, message, category,
  }),
}));

import { batchApproveRuns } from '../batch-approve-runs';
import { batchRejectRuns } from '../batch-reject-runs';

describe('batchActions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects batch >25 items via Zod', async () => {
    const ids = Array.from({ length: 26 }, (_, i) => crypto.randomUUID());
    const result = await batchApproveRuns({ runIds: ids });
    expect(result.success).toBe(false);
  });

  it('rejects empty batch via Zod', async () => {
    const result = await batchApproveRuns({ runIds: [] });
    expect(result.success).toBe(false);
  });

  it('rejects invalid runIds via Zod', async () => {
    const result = await batchApproveRuns({ runIds: ['not-a-uuid'] });
    expect(result.success).toBe(false);
  });

  it('batchRejectRuns rejects >25 items', async () => {
    const ids = Array.from({ length: 26 }, () => crypto.randomUUID());
    const result = await batchRejectRuns({ runIds: ids });
    expect(result.success).toBe(false);
  });
});
