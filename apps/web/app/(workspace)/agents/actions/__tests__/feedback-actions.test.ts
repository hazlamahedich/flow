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
            single: vi.fn().mockResolvedValue({ data: { id: 'run-1', agent_id: 'inbox' }, error: null }),
          })),
        })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'fb-1', sentiment: 'positive', note: null, created_at: '2026-01-01' }, error: null }),
        })),
      })),
    })),
  })),
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
  requireTenantContext: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'u-1' }),
}));

import { submitFeedback, deleteFeedback } from '../feedback-actions';

describe('submitFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid input (missing fields)', async () => {
    const result = await submitFeedback({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.category).toBe('validation');
    }
  });

  it('rejects non-UUID runId', async () => {
    const result = await submitFeedback({ runId: 'not-a-uuid', sentiment: 'positive' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sentiment', async () => {
    const result = await submitFeedback({ runId: '00000000-0000-0000-0000-000000000001', sentiment: 'meh' });
    expect(result.success).toBe(false);
  });

  it('accepts note as optional', async () => {
    const result = await submitFeedback({ runId: '00000000-0000-0000-0000-000000000001', sentiment: 'negative' });
    expect(result.success).toBe(true);
  });

  it('rejects note over 500 chars', async () => {
    const result = await submitFeedback({ runId: '00000000-0000-0000-0000-000000000001', sentiment: 'positive', note: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects null input', async () => {
    const result = await submitFeedback(null);
    expect(result.success).toBe(false);
  });

  it('rejects array input', async () => {
    const result = await submitFeedback([]);
    expect(result.success).toBe(false);
  });
});

describe('deleteFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid input (missing fields)', async () => {
    const result = await deleteFeedback({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.category).toBe('validation');
    }
  });

  it('rejects non-UUID feedbackId', async () => {
    const result = await deleteFeedback({ feedbackId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects null input', async () => {
    const result = await deleteFeedback(null);
    expect(result.success).toBe(false);
  });
});
