import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn().mockResolvedValue({ workspaceId: 'ws-1' }),
  recordTrustViolation: vi.fn(),
  createFlowError: vi.fn((code, type, msg) => ({ code, type, message: msg })),
}));

const mockAuth = {
  getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1' } } }),
};

function createChain(resolvedValues: Record<string, any>) {
  const chain: any = {
    auth: mockAuth,
  };
  chain.from = vi.fn().mockImplementation((table: string) => {
    if (table === 'emails') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(
          resolvedValues.emailSelect ?? {
            data: { category: 'info', client_inbox_id: 'inbox-1' },
            error: null,
          },
        ),
        update: vi.fn().mockReturnThis(),
      };
    }
    if (table === 'recategorization_log') {
      return {
        insert: vi
          .fn()
          .mockResolvedValue(resolvedValues.logInsert ?? { error: null }),
      };
    }
    if (table === 'trust_matrix') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue(
            resolvedValues.trustSelect ?? { data: { version: 1 }, error: null },
          ),
      };
    }
    return chain;
  });
  return chain;
}

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../schemas', () => ({
  promoteToInboxSchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: { emailId: '00000000-0000-0000-0000-000000000001' },
    }),
  },
}));

import * as actions from '../handled-quietly-actions';
import * as db from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';

describe('handled-quietly-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getServerSupabase as any).mockResolvedValue(createChain({}));
  });

  it('promoteToInbox should update category and record violation', async () => {
    const result = await actions.promoteToInbox({
      emailId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result.success).toBe(true);
    expect(db.recordTrustViolation).toHaveBeenCalled();
  });

  it('promoteToInbox returns error when email not found', async () => {
    (getServerSupabase as any).mockResolvedValue(
      createChain({
        emailSelect: { data: null, error: { message: 'not found' } },
      }),
    );

    const result = await actions.promoteToInbox({
      emailId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result.success).toBe(false);
  });

  it('promoteToInbox returns error when user not authenticated', async () => {
    mockAuth.getUser.mockResolvedValueOnce({ data: { user: null } });

    const result = await actions.promoteToInbox({
      emailId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result.success).toBe(false);
  });

  it('promoteToInbox succeeds even when trust_matrix has no entry', async () => {
    (getServerSupabase as any).mockResolvedValue(
      createChain({
        trustSelect: { data: null, error: null },
      }),
    );

    const result = await actions.promoteToInbox({
      emailId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result.success).toBe(true);
    expect(db.recordTrustViolation).not.toHaveBeenCalled();
  });

  it('promoteToInbox succeeds even when recategorization_log insert fails', async () => {
    (getServerSupabase as any).mockResolvedValue(
      createChain({
        logInsert: { error: { message: 'insert failed' } },
      }),
    );

    const result = await actions.promoteToInbox({
      emailId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result.success).toBe(true);
  });

  it('promoteToInbox handles trust violation throw gracefully', async () => {
    (db.recordTrustViolation as any).mockRejectedValueOnce(
      new Error('db down'),
    );

    const result = await actions.promoteToInbox({
      emailId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result.success).toBe(true);
  });
});
