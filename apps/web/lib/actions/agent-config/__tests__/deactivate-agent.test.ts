import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
  }),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

const mockRequireTenantContext = vi.fn().mockResolvedValue({
  workspaceId: 'ws-1',
  userId: 'user-1',
  role: 'owner',
});

vi.mock('@flow/db', () => ({
  requireTenantContext: (...args: unknown[]) => mockRequireTenantContext(...args),
  createServerClient: vi.fn().mockReturnValue({
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  }),
  updateAgentConfig: vi.fn(),
}));

vi.mock('@flow/agents', () => ({
  beginDrain: vi.fn(),
}));

import { deactivateAgent } from '../actions';
import { beginDrain } from '@flow/agents';
import { revalidateTag } from 'next/cache';

describe('deactivateAgent', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls beginDrain and revalidates on success', async () => {
    vi.mocked(beginDrain).mockResolvedValueOnce({
      agentId: 'inbox',
      status: 'draining',
      affectedRuns: 3,
    } as unknown as Awaited<ReturnType<typeof beginDrain>>);

    const result = await deactivateAgent({
      agentId: 'inbox',
      expectedVersion: 1,
    });

    expect(result.success).toBe(true);
    expect(beginDrain).toHaveBeenCalledWith('ws-1', 'inbox', 1);
    expect(revalidateTag).toHaveBeenCalledWith('agents:ws-1');
  });

  it('returns error when beginDrain throws', async () => {
    vi.mocked(beginDrain).mockRejectedValueOnce(new Error('Agent has active runs'));

    const result = await deactivateAgent({
      agentId: 'calendar',
      expectedVersion: 2,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('DRAIN_ERROR');
      expect(result.error.message).toBe('Agent has active runs');
    }
  });

  it('returns validation error for invalid input', async () => {
    const result = await deactivateAgent({ agentId: 123, expectedVersion: 'bad' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns validation error for missing fields', async () => {
    const result = await deactivateAgent({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('handles non-Error thrown values', async () => {
    vi.mocked(beginDrain).mockRejectedValueOnce('string error');

    const result = await deactivateAgent({
      agentId: 'inbox',
      expectedVersion: 1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('Deactivation failed');
    }
  });
});
