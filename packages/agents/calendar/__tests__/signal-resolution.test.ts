import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveOriginatingSignal } from '../signal-resolution';

function createMockSupabase(
  signals: Array<{ id: string }> | null = null,
  updateError: unknown = null,
) {
  const signalSelectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: signals }),
  };

  const signalUpdateChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: updateError }),
  };

  return {
    from: vi.fn(() => ({
      ...signalSelectChain,
      ...signalUpdateChain,
    })),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveOriginatingSignal', () => {
  it('returns immediately when sourceEmailId is null', async () => {
    const supabase = createMockSupabase();

    await resolveOriginatingSignal(supabase, 'ws-1', null);

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('resolves matching signal', async () => {
    const supabase = createMockSupabase([{ id: 'sig-1' }]);

    await resolveOriginatingSignal(supabase, 'ws-1', 'email-1');

    expect(supabase.from).toHaveBeenCalledWith('agent_signals');
  });

  it('does nothing when no matching signal found', async () => {
    const supabase = createMockSupabase([]);

    await resolveOriginatingSignal(supabase, 'ws-1', 'email-1');

    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('does nothing when signals query returns null', async () => {
    const supabase = createMockSupabase(null);

    await resolveOriginatingSignal(supabase, 'ws-1', 'email-1');

    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('suppresses errors without throwing', async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error('DB error');
      }),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    await expect(
      resolveOriginatingSignal(supabase, 'ws-1', 'email-1'),
    ).resolves.toBeUndefined();
  });
});
