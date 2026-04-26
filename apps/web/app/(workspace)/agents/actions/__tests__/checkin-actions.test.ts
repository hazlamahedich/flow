import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
  })),
}));

import { deferCheckIn, acknowledgeCheckIn } from '../checkin-actions';

describe('deferCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns validation error for invalid input', async () => {
    const result = await deferCheckIn({ workspaceId: 'not-a-uuid', agentId: 'inbox' });
    expect(result.success).toBe(false);
  });

  it('returns validation error for empty agentId', async () => {
    const result = await deferCheckIn({ workspaceId: '00000000-0000-0000-0000-000000000001', agentId: '' });
    expect(result.success).toBe(false);
  });

  it('returns validation error for missing fields', async () => {
    const result = await deferCheckIn({});
    expect(result.success).toBe(false);
  });
});

describe('acknowledgeCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns validation error for invalid workspaceId', async () => {
    const result = await acknowledgeCheckIn({ workspaceId: 'bad', agentId: 'inbox' });
    expect(result.success).toBe(false);
  });

  it('returns validation error for empty agentId', async () => {
    const result = await acknowledgeCheckIn({ workspaceId: '00000000-0000-0000-0000-000000000001', agentId: '' });
    expect(result.success).toBe(false);
  });

  it('Zod rejects non-UUID workspaceId', async () => {
    const result = await deferCheckIn({ workspaceId: '123', agentId: 'inbox' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.category).toBe('validation');
    }
  });

  it('Zod rejects non-string agentId', async () => {
    const result = await deferCheckIn({ workspaceId: '00000000-0000-0000-0000-000000000001', agentId: 123 as never });
    expect(result.success).toBe(false);
  });
});
