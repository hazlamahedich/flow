import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn().mockResolvedValue({ workspaceId: 'ws-1' }),
  recategorizeEmail: vi.fn(),
  insertSignal: vi.fn(),
  recordTrustViolation: vi.fn(),
  createFlowError: vi.fn((code, type, msg) => ({ code, type, message: msg })),
}));

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { recategorizeEmail } from '../recategorize-action';
import {
  requireTenantContext,
  createFlowError,
  recategorizeEmail as recategorizeQuery,
  insertSignal,
} from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';

describe('recategorizeEmail action', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1' } } }),
      },
    };
    (getServerSupabase as any).mockResolvedValue(mockSupabase);
    (recategorizeQuery as any).mockResolvedValue(undefined);
    (insertSignal as any).mockResolvedValue(undefined);
  });

  it('returns validation error for invalid input', async () => {
    const result = await recategorizeEmail({
      emailId: 'not-uuid',
      newCategory: 'urgent',
    });

    expect(result.success).toBe(false);
  });

  it('returns 404 when email not found', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: new Error('Not found'),
    });

    const result = await recategorizeEmail({
      emailId: 'e1111111-1111-1111-1111-111111111111',
      newCategory: 'urgent',
    });

    expect(result.success).toBe(false);
  });

  it('returns success with no-op when category unchanged', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { category: 'urgent', client_inbox_id: 'inbox-1' },
      error: null,
    });

    const result = await recategorizeEmail({
      emailId: 'e1111111-1111-1111-1111-111111111111',
      newCategory: 'urgent',
    });

    expect(result.success).toBe(true);
    expect(recategorizeQuery).not.toHaveBeenCalled();
  });

  it('recategorizes, logs, emits signal, and records trust violation', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { category: 'info', client_inbox_id: 'inbox-1' },
      error: null,
    });
    mockSupabase.single.mockResolvedValueOnce({
      data: { version: 1 },
      error: null,
    });

    const result = await recategorizeEmail({
      emailId: 'e1111111-1111-1111-1111-111111111111',
      newCategory: 'urgent',
    });

    expect(result.success).toBe(true);
    expect(recategorizeQuery).toHaveBeenCalled();
    expect(mockSupabase.insert).toHaveBeenCalled();
    expect(insertSignal).toHaveBeenCalledWith(
      expect.objectContaining({ signalType: 'email.categorization_corrected' }),
    );
  });

  it('returns error when recategorize query fails', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { category: 'info', client_inbox_id: 'inbox-1' },
      error: null,
    });
    (recategorizeQuery as any).mockRejectedValue(new Error('DB error'));

    const result = await recategorizeEmail({
      emailId: 'e1111111-1111-1111-1111-111111111111',
      newCategory: 'urgent',
    });

    expect(result.success).toBe(false);
  });

  it('returns 401 when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    mockSupabase.single.mockResolvedValueOnce({
      data: { category: 'info', client_inbox_id: 'inbox-1' },
      error: null,
    });

    const result = await recategorizeEmail({
      emailId: 'e1111111-1111-1111-1111-111111111111',
      newCategory: 'urgent',
    });

    expect(result.success).toBe(false);
  });
});
