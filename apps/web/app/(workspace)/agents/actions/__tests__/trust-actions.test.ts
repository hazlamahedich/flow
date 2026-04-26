import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@flow/db', () => ({
  updateTrustMatrixEntry: vi.fn(),
  insertTransition: vi.fn(),
  getTrustMatrixEntry: vi.fn(),
  createServerClient: vi.fn(),
  createServiceClient: vi.fn(),
  requireTenantContext: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
  }),
}));

import {
  upgradeTrustLevel,
  downgradeTrustLevel,
  undoRegression,
} from '../trust-actions';
import {
  updateTrustMatrixEntry,
  insertTransition,
  requireTenantContext,
} from '@flow/db';

const mockContext = { workspaceId: 'ws-1', userId: 'user-1' };

beforeEach(() => {
  vi.clearAllMocks();
  (requireTenantContext as ReturnType<typeof vi.fn>).mockResolvedValue(mockContext);
  (updateTrustMatrixEntry as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'm1', score: 75, version: 2,
  });
  (insertTransition as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 't1' });
});

describe('upgradeTrustLevel', () => {
  it('returns validation error for invalid input', async () => {
    const result = await upgradeTrustLevel({ bad: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns success on valid upgrade', async () => {
    const result = await upgradeTrustLevel({
      matrixEntryId: '00000000-0000-0000-0000-000000000001',
      fromLevel: 'supervised',
      toLevel: 'confirm',
      expectedVersion: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fromLevel).toBe('supervised');
      expect(result.data.toLevel).toBe('confirm');
    }
  });

  it('handles concurrent modification error', async () => {
    (updateTrustMatrixEntry as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('CAS failed'),
    );
    const result = await upgradeTrustLevel({
      matrixEntryId: '00000000-0000-0000-0000-000000000001',
      fromLevel: 'supervised',
      toLevel: 'confirm',
      expectedVersion: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFLICT');
    }
  });
});

describe('downgradeTrustLevel', () => {
  it('returns success on valid downgrade', async () => {
    const result = await downgradeTrustLevel({
      matrixEntryId: '00000000-0000-0000-0000-000000000001',
      fromLevel: 'auto',
      toLevel: 'confirm',
      expectedVersion: 1,
      triggerType: 'soft_violation',
      triggerReason: '3 failed tasks',
    });
    expect(result.success).toBe(true);
  });

  it('sets cooldown on downgrade', async () => {
    await downgradeTrustLevel({
      matrixEntryId: '00000000-0000-0000-0000-000000000001',
      fromLevel: 'auto',
      toLevel: 'confirm',
      expectedVersion: 1,
      triggerType: 'hard_violation',
      triggerReason: 'bad output',
    });
    expect(updateTrustMatrixEntry).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cooldown_until: expect.any(String) }),
      expect.any(Number),
    );
  });
});

describe('undoRegression', () => {
  it('returns success on valid undo within cooldown', async () => {
    const { createServiceClient } = await import('@flow/db');
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: {
                  id: 'm1',
                  cooldown_until: new Date(Date.now() + 7 * 86400000).toISOString(),
                  current_level: 'confirm',
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    const result = await undoRegression({
      transitionId: '00000000-0000-0000-0000-000000000002',
      matrixEntryId: '00000000-0000-0000-0000-000000000001',
      expectedVersion: 1,
    });
    expect(result.success).toBe(true);
  });

  it('returns error when cooldown has expired', async () => {
    const { createServiceClient } = await import('@flow/db');
    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: {
                  id: 'm1',
                  cooldown_until: new Date(Date.now() - 1000).toISOString(),
                  current_level: 'confirm',
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    const result = await undoRegression({
      transitionId: '00000000-0000-0000-0000-000000000002',
      matrixEntryId: '00000000-0000-0000-0000-000000000001',
      expectedVersion: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('expired');
    }
  });
});
