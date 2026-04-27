import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string) => ({ status, code, message, category }),
  checkDuplicateEmail: vi.fn(),
}));

import { checkDuplicateEmailAction } from '../check-duplicate-email';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, checkDuplicateEmail } from '@flow/db';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockRequireTenantContext = vi.mocked(requireTenantContext);
const mockCheckDuplicateEmail = vi.mocked(checkDuplicateEmail);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSupabase.mockResolvedValue({} as never);
  mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'owner' });
  mockCheckDuplicateEmail.mockResolvedValue(null);
});

describe('checkDuplicateEmailAction', () => {
  it('returns exists=false for empty email', async () => {
    const result = await checkDuplicateEmailAction({ email: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.exists).toBe(false);
    expect(mockCheckDuplicateEmail).not.toHaveBeenCalled();
  });

  it('returns exists=false when no duplicate found', async () => {
    const result = await checkDuplicateEmailAction({ email: 'new@example.com' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.exists).toBe(false);
  });

  it('returns exists=true when duplicate found', async () => {
    mockCheckDuplicateEmail.mockResolvedValue({ id: 'c1', name: 'Existing Client', status: 'active' } as never);
    const result = await checkDuplicateEmailAction({ email: 'dup@example.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.exists).toBe(true);
      expect(result.data.clientId).toBe('c1');
      expect(result.data.clientName).toBe('Existing Client');
    }
  });

  it('rejects members', async () => {
    mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'member' });
    const result = await checkDuplicateEmailAction({ email: 'test@example.com' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('trims email before checking', async () => {
    const result = await checkDuplicateEmailAction({ email: '  spaced@example.com  ' });
    expect(result.success).toBe(true);
    expect(mockCheckDuplicateEmail).toHaveBeenCalledWith(expect.anything(), 'ws1', 'spaced@example.com');
  });
});
