import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as actions from '../handled-quietly-actions';
import * as db from '@flow/db';

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn().mockResolvedValue({ workspaceId: 'ws-1' }),
  getHandledEmails: vi.fn(),
  recordTrustViolation: vi.fn(),
  createFlowError: vi.fn((code, type, msg) => ({ code, type, message: msg })),
}));

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { category: 'info', client_inbox_id: 'inbox-1' } }),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1' } } }),
    },
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('handled-quietly-actions', () => {
  it('promoteToInbox should update category and record violation', async () => {
    const result = await actions.promoteToInbox({ emailId: 'e-1' });
    
    expect(result.success).toBe(true);
    expect(db.recordTrustViolation).toHaveBeenCalled();
  });
});
