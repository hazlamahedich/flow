import { describe, it, expect, beforeEach, vi } from 'vitest';
import { classifyAndUpdateEvent } from '../classify-source';

function createMockSupabase(updateError: string | null = null) {
  const eq2 = vi.fn().mockResolvedValue({
    error: updateError ? { message: updateError } : null,
  });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const update = vi.fn().mockReturnValue({ eq: eq1 });
  return {
    from: vi.fn(() => ({ update })),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('classifyAndUpdateEvent', () => {
  it('classifies and persists va_created source', async () => {
    const supabase = createMockSupabase();

    const result = await classifyAndUpdateEvent(
      supabase,
      'evt-1',
      'ws-1',
      [{ emailAddress: 'client@example.com' }],
      'va@test.com',
      {
        organizerEmail: 'va@test.com',
        title: 'Test Meeting',
        isRecurring: false,
      },
    );

    expect(result).toBe('va_created');
    expect(supabase.from).toHaveBeenCalledWith('calendar_events');
  });

  it('classifies and persists third_party source', async () => {
    const supabase = createMockSupabase();

    const result = await classifyAndUpdateEvent(
      supabase,
      'evt-1',
      'ws-1',
      [],
      'va@test.com',
      {
        organizerEmail: 'user@calendly.com',
        title: 'Scheduling',
        isRecurring: false,
      },
    );

    expect(result).toBe('third_party');
  });

  it('classifies and persists auto_generated source', async () => {
    const supabase = createMockSupabase();

    const result = await classifyAndUpdateEvent(
      supabase,
      'evt-1',
      'ws-1',
      [],
      'va@test.com',
      {
        organizerEmail: 'someone@other.com',
        title: 'Holiday OOO',
        isRecurring: true,
      },
    );

    expect(result).toBe('auto_generated');
  });

  it('throws SOURCE_UPDATE_FAILED on DB error', async () => {
    const supabase = createMockSupabase('Update failed');

    await expect(
      classifyAndUpdateEvent(supabase, 'evt-1', 'ws-1', [], 'va@test.com', {
        organizerEmail: 'va@test.com',
        title: 'Test',
        isRecurring: false,
      }),
    ).rejects.toMatchObject({ code: 'SOURCE_UPDATE_FAILED', statusCode: 500 });
  });
});
