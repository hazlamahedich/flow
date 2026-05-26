import { describe, it, expect, beforeEach, vi } from 'vitest';
import { findAvailableSlots } from '../slot-finder';
import type { SlotFinderParams, SlotFinderDeps } from '../slot-finder';
import type { CalendarProvider, FreeBusySlot } from '../../providers/calendar-provider';
import type { SupabaseClient } from '@supabase/supabase-js';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const CLIENT_ID = '00000000-0000-4000-8000-000000000002';

function mockSupabaseWithConflicts(count: number) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockResolvedValue({
    data: Array.from({ length: count }, () => ({ start_at: '2026-01-01T00:00:00Z', end_at: '2026-01-01T01:00:00Z' })),
    error: null,
  });
  return { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient;
}

function mockSupabaseEmpty() {
  return mockSupabaseWithConflicts(0);
}

function createMockProvider(busySlots: Array<{ start: string; end: string }> = []): CalendarProvider {
  const freeBusyResult: FreeBusySlot[] = [{
    calendarId: 'cal-1',
    busy: busySlots,
  }];
  return {
    getFreeBusy: vi.fn().mockResolvedValue(freeBusyResult),
  } as unknown as CalendarProvider;
}

function makeParams(overrides?: Partial<SlotFinderParams>): SlotFinderParams {
  const now = new Date();
  const futureDate = new Date(now.getTime() + 48 * 3600_000);
  const _startStr = futureDate.toISOString();

  return {
    workspaceId: WORKSPACE_ID,
    clientId: CLIENT_ID,
    durationMinutes: 30,
    calendars: [{
      id: 'cal-id-1',
      calendarId: 'cal-1',
      provider: createMockProvider(),
      accessToken: 'test-token',
    }],
    ...overrides,
  };
}

describe('findAvailableSlots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns up to 3 available slots', async () => {
    const params = makeParams();
    const deps: SlotFinderDeps = { supabase: mockSupabaseEmpty() };
    const slots = await findAvailableSlots(params, deps);
    expect(slots.length).toBeLessThanOrEqual(3);
  });

  it('returns empty array when no calendars connected', async () => {
    const params = makeParams({ calendars: [] });
    const mockSupa = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ data: [], error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;
    const deps: SlotFinderDeps = { supabase: mockSupa };
    const slots = await findAvailableSlots(params, deps);
    expect(slots).toEqual([]);
  });

  it('skips slots that conflict with busy periods', async () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 48 * 3600_000);
    futureDate.setHours(10, 0, 0, 0);
    const busyStart = futureDate.toISOString();
    const busyEnd = new Date(futureDate.getTime() + 3600_000).toISOString();

    const provider = createMockProvider([{ start: busyStart, end: busyEnd }]);
    const params = makeParams({
      calendars: [{ id: 'cal-id-1', calendarId: 'cal-1', provider, accessToken: 'test-token' }],
      preferredWindow: {
        start: futureDate.toISOString(),
        end: new Date(futureDate.getTime() + 8 * 3600_000).toISOString(),
      },
    });
    const deps: SlotFinderDeps = { supabase: mockSupabaseEmpty() };
    const slots = await findAvailableSlots(params, deps);
    for (const slot of slots) {
      const slotStart = new Date(slot.startAt).getTime();
      const slotEnd = new Date(slot.endAt).getTime();
      const busyStartTime = new Date(busyStart).getTime();
      const busyEndTime = new Date(busyEnd).getTime();
      const overlaps = slotStart < busyEndTime && slotEnd > busyStartTime;
      expect(overlaps).toBe(false);
    }
  });

  it('handles provider timeout gracefully', async () => {
    const slowProvider = {
      getFreeBusy: vi.fn().mockImplementation(() => new Promise((_res, rej) => {
        setTimeout(() => rej(new Error('timeout')), 100);
      })),
    } as unknown as CalendarProvider;

    const params = makeParams({
      calendars: [{ id: 'cal-id-1', calendarId: 'cal-1', provider: slowProvider, accessToken: 'test-token' }],
    });
    const deps: SlotFinderDeps = { supabase: mockSupabaseEmpty() };
    const slots = await findAvailableSlots(params, deps);
    expect(slots).toBeDefined();
  });

  it('executes calendar checks in parallel via Promise.allSettled', async () => {
    const provider1 = createMockProvider();
    const provider2 = createMockProvider();
    const params = makeParams({
      calendars: [
        { id: 'cal-1', calendarId: 'c1', provider: provider1, accessToken: 't1' },
        { id: 'cal-2', calendarId: 'c2', provider: provider2, accessToken: 't2' },
      ],
    });
    const deps: SlotFinderDeps = { supabase: mockSupabaseEmpty() };
    await findAvailableSlots(params, deps);
    expect(provider1.getFreeBusy).toHaveBeenCalled();
    expect(provider2.getFreeBusy).toHaveBeenCalled();
  });

  it('completes within 5 seconds (slot-finder SLA)', async () => {
    const params = makeParams();
    const deps: SlotFinderDeps = { supabase: mockSupabaseEmpty() };
    const start = performance.now();
    await findAvailableSlots(params, deps);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });
});
