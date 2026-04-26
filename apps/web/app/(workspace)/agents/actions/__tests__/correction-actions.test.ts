import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
  })),
}));

vi.mock('@flow/db', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    })),
  })),
  requireTenantContext: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'u-1' }),
  mapRun: vi.fn((r: Record<string, unknown>) => r),
}));

import { issueCorrection, getOriginalRunForCorrection } from '../correction-actions';

describe('issueCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid input (missing fields)', async () => {
    const result = await issueCorrection({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.category).toBe('validation');
    }
  });

  it('rejects non-UUID originalRunId', async () => {
    const result = await issueCorrection({ originalRunId: 'not-a-uuid', correctedOutput: { foo: 'bar' } });
    expect(result.success).toBe(false);
  });

  it('rejects non-object correctedOutput', async () => {
    const result = await issueCorrection({ originalRunId: '00000000-0000-0000-0000-000000000001', correctedOutput: 'string' });
    expect(result.success).toBe(false);
  });

  it('rejects null input', async () => {
    const result = await issueCorrection(null);
    expect(result.success).toBe(false);
  });

  it('rejects array input', async () => {
    const result = await issueCorrection([]);
    expect(result.success).toBe(false);
  });
});

describe('getOriginalRunForCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects empty string runId', async () => {
    const result = await getOriginalRunForCorrection('');
    expect(result.success).toBe(false);
  });
});
