import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emitDailyPreviewSignal } from '../daily-preview';

function createMockSupabase(
  events: Record<string, unknown>[] = [],
  clients: Record<string, unknown>[] = [],
  conflicts: Record<string, unknown>[] = [],
  bypassData: Record<string, unknown>[] = [],
  insertError: string | null = null,
) {
  const insertChain = {
    insert: vi.fn().mockResolvedValue({ error: insertError ? { message: insertError } : null }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'calendar_events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: events, error: null }),
        };
      }
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: clients, error: null }),
        };
      }
      if (table === 'agent_signals') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({ data: conflicts, error: null }),
          ...insertChain,
        };
      }
      if (table === 'calendar_bypass_metrics') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gt: vi.fn().mockResolvedValue({ data: bypassData, error: null }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('emitDailyPreviewSignal', () => {
  it('emits signal with preview payload', async () => {
    const supabase = createMockSupabase();

    await emitDailyPreviewSignal('ws-1', { supabase });

    expect(supabase.from).toHaveBeenCalledWith('agent_signals');
  });

  it('throws PREVIEW_SIGNAL_FAILED on insert error', async () => {
    const supabase = createMockSupabase([], [], [], [], 'Insert failed');

    await expect(
      emitDailyPreviewSignal('ws-1', { supabase }),
    ).rejects.toMatchObject({ code: 'PREVIEW_SIGNAL_FAILED' });
  });

  it('includes events and bypass alerts in payload', async () => {
    const events = [
      { title: 'Meeting', start_at: '2026-05-24T10:00:00Z', end_at: '2026-05-24T11:00:00Z', source: 'va_created', client_id: 'client-1' },
    ];
    const clients = [{ id: 'client-1', name: 'Acme Corp' }];
    const bypassData = [
      { client_id: 'client-1', bypass_rate: '0.5000', total_events: 10, bypass_count: 5 },
    ];
    const supabase = createMockSupabase(events, clients, [], bypassData);

    await emitDailyPreviewSignal('ws-1', { supabase });

    expect(supabase.from).toHaveBeenCalledWith('agent_signals');
  });
});
