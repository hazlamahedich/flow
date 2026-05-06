import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeTrustLevel, meetsDraftGate } from '../trust';
import { createServiceClient } from '@flow/db';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

describe('trust', () => {
  const workspaceId = 'w1111111-1111-1111-1111-111111111111';
  const clientInboxId = 'i1111111-1111-1111-1111-111111111111';
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      upsert: vi.fn(),
      maybeSingle: vi.fn(),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);
  });

  it('should return trust 1 if no metrics found', async () => {
    // Chain for .from().select().eq().eq()
    const mockSelect = {
      eq: vi.fn().mockReturnThis(),
    };
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const level = await computeTrustLevel(workspaceId, clientInboxId);

    expect(level).toBe(1);
  });

  it('should reach trust 2 at boundary (recat_rate <= 0.15, samples >= 20)', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { metric_type: 'recategorization_rate', metric_value: 0.15, sample_count: 20 },
            ],
            error: null,
          }),
        }),
      }),
    });

    const level = await computeTrustLevel(workspaceId, clientInboxId);

    expect(level).toBe(2);
  });

  it('should reach trust 3 at boundary (recat <= 0.1, samples >= 50, draft >= 0.8)', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { metric_type: 'recategorization_rate', metric_value: 0.1, sample_count: 50 },
              { metric_type: 'draft_acceptance_rate', metric_value: 0.8, sample_count: 10 },
            ],
            error: null,
          }),
        }),
      }),
    });

    const level = await computeTrustLevel(workspaceId, clientInboxId);

    expect(level).toBe(3);
  });

  it('should meet draft gate at trust 2', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { metric_type: 'recategorization_rate', metric_value: 0.15, sample_count: 20 },
            ],
            error: null,
          }),
        }),
      }),
    });

    const meets = await meetsDraftGate(workspaceId, clientInboxId);

    expect(meets).toBe(true);
  });

  it('should not meet draft gate at trust 1', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { metric_type: 'recategorization_rate', metric_value: 0.2, sample_count: 20 },
            ],
            error: null,
          }),
        }),
      }),
    });

    const meets = await meetsDraftGate(workspaceId, clientInboxId);

    expect(meets).toBe(false);
  });
});
