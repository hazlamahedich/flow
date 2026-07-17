import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateDailyPreview } from '../daily-preview';

function createMockSupabase(
  eventRows: Record<string, unknown>[] = [],
  clientRows: Record<string, unknown>[] = [],
  conflictRows: Record<string, unknown>[] = [],
  bypassRows: Record<string, unknown>[] = [],
) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'workspaces') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { timezone: 'UTC' } }),
            }),
          }),
        };
      }
      if (table === 'calendar_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: eventRows }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: clientRows }),
          }),
        };
      }
      if (table === 'agent_signals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockResolvedValue({ data: conflictRows }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'calendar_bypass_metrics') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockResolvedValue({ data: bypassRows }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateDailyPreview', () => {
  it('returns empty preview when no events', async () => {
    const supabase = createMockSupabase([], [], [], []);
    const result = await generateDailyPreview('ws-1', { supabase });

    expect(result.events).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    expect(result.bypassAlerts).toHaveLength(0);
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('includes events with client names in preview', async () => {
    const eventRows = [
      {
        title: 'Team Standup',
        start_at: '2026-05-24T09:00:00Z',
        end_at: '2026-05-24T09:30:00Z',
        source: 'va_created',
        client_id: 'c-1',
      },
    ];
    const clientRows = [{ id: 'c-1', name: 'Acme Corp' }];
    const supabase = createMockSupabase(eventRows, clientRows);

    const result = await generateDailyPreview('ws-1', { supabase });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.title).toBe('Team Standup');
    expect(result.events[0]!.clientName).toBe('Acme Corp');
  });

  it('identifies gaps between events', async () => {
    const eventRows = [
      {
        title: 'Morning',
        start_at: '2026-05-24T09:00:00Z',
        end_at: '2026-05-24T10:00:00Z',
        source: 'va_created',
        client_id: null,
      },
      {
        title: 'Afternoon',
        start_at: '2026-05-24T14:00:00Z',
        end_at: '2026-05-24T15:00:00Z',
        source: 'va_created',
        client_id: null,
      },
    ];
    const supabase = createMockSupabase(eventRows);

    const result = await generateDailyPreview('ws-1', { supabase });

    expect(result.gaps.length).toBeGreaterThanOrEqual(1);
    expect(result.gaps[0]!.durationMinutes).toBeGreaterThanOrEqual(30);
  });
});
