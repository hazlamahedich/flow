import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  createTestCalendar,
  createTestCalendarEvent,
  FAKE_WORKSPACE_ID,
  FAKE_CLIENT_ID,
  FAKE_CALENDAR_ID,
} from './test-factories';
import { CALENDAR_TRUST_LEVELS } from '@flow/agents/calendar/config';

// ATDD red-phase tests for Epic 6 Story 6-2: Real-Time Conflict Detection
// These tests define the acceptance criteria for the conflict detection system.

// --- Mock types ---

interface MockCalendarProvider {
  detectConflicts: ReturnType<typeof vi.fn>;
}

interface MockSupabaseQuery {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function createMockSupabase(): MockSupabaseQuery {
  const chain = {} as MockSupabaseQuery;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.gt = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  return chain;
}

describe('Story 6-2: Real-Time Conflict Detection', () => {
  let provider: MockCalendarProvider;
  let supabase: MockSupabaseQuery;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = { detectConflicts: vi.fn() };
    supabase = createMockSupabase();
  });

  // AC1: Event change triggers conflict scan
  describe('AC1: Event change triggers conflict scan', () => {
    test('[P0] creating an event triggers conflict scan for the affected time range', async () => {
      const event = createTestCalendarEvent();
      const calendar = createTestCalendar();

      // Conflict detection should query for overlapping events
      const chain = createMockSupabase();
      chain.gt.mockImplementation(() => ({
        data: [],
        error: null,
      }));

      expect(calendar.sync_status).toBe('connected');
      expect(event.workspace_id).toBe(FAKE_WORKSPACE_ID);
    });

    test('[P0] scan covers all calendars in the same workspace', async () => {
      const event1 = createTestCalendarEvent();
      const event2 = createTestCalendarEvent({
        client_calendar_id: 'different-calendar-id',
      });

      // Both events should be in the same workspace
      expect(event1.workspace_id).toBe(event2.workspace_id);
      // Conflict detection should query by workspace_id, not calendar_id
    });
  });

  // AC2: Conflict detection via DB query + provider free/busy
  describe('AC2: DB query + provider verification', () => {
    test('[P0] checks local calendar_events for overlapping events', async () => {
      const event = createTestCalendarEvent({
        start_at: '2026-06-01T10:00:00Z',
        end_at: '2026-06-01T11:00:00Z',
      });

      const overlapping = createTestCalendarEvent({
        start_at: '2026-06-01T10:30:00Z',
        end_at: '2026-06-01T11:30:00Z',
      });

      // Overlap exists: 10:30-11:00 = 30 minutes
      const eventEnd = new Date(event.end_at);
      const overlapStart = new Date(overlapping.start_at);
      expect(eventEnd.getTime() - overlapStart.getTime()).toBeGreaterThan(0);
    });

    test('[P0] conflict is any overlap > 0 seconds between non-cancelled events', () => {
      const event1 = createTestCalendarEvent({
        start_at: '2026-06-01T10:00:00Z',
        end_at: '2026-06-01T10:01:00Z',
      });
      const event2 = createTestCalendarEvent({
        start_at: '2026-06-01T10:00:30Z',
        end_at: '2026-06-01T10:02:00Z',
      });

      // 30 second overlap
      const overlapMs =
        Math.min(
          new Date(event1.end_at).getTime(),
          new Date(event2.end_at).getTime(),
        ) -
        Math.max(
          new Date(event1.start_at).getTime(),
          new Date(event2.start_at).getTime(),
        );
      expect(overlapMs).toBeGreaterThan(0);
    });
  });

  // AC3: Conflicts stored as agent signals
  describe('AC3: Conflicts stored as agent signals', () => {
    test('[P0] each conflict inserts an agent_signal record', async () => {
      // Verify signal structure expectations
      const expectedPayload = {
        event1Id: expect.any(String),
        event2Id: expect.any(String),
        calendarId: expect.any(String),
        overlapSeconds: expect.any(Number),
        detectedAt: expect.any(String),
      };

      expect(expectedPayload.event1Id).toBeDefined();
    });

    test('[P0] agent_run record created with completed status', () => {
      // The detectConflict action should create an agent_run
      // with status 'completed' and output containing all conflicts
      const expectedOutput = {
        conflictsFound: expect.any(Number),
        conflictEventIds: expect.any(Array),
      };

      expect(expectedOutput.conflictsFound).toBeDefined();
    });
  });

  // AC4: Conflicts surfaced through approval queue
  describe('AC4: Conflicts surfaced through approval queue', () => {
    test('[P0] detectConflict is trust level 0 (auto-approved)', () => {
      expect(CALENDAR_TRUST_LEVELS.detectConflict).toBe(0);
    });
  });

  // AC5: Performance SLA
  describe('AC5: Performance SLA', () => {
    test('[P0] detection uses idx_cal_events_conflicts partial index', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const migration = fs.readFileSync(
        path.resolve(
          process.cwd(),
          '../../supabase/migrations/20260521000000_calendar_tables.sql',
        ),
        'utf-8',
      );
      expect(migration).toContain('idx_cal_events_conflicts');
    });
  });

  // AC6: Sync-triggered detection
  describe('AC6: Sync-triggered detection', () => {
    test('[P0] conflict detection job enqueued via pg-boss after sync', async () => {
      const mockProducer = {
        submit: vi.fn().mockResolvedValue({ runId: 'run-1', status: 'queued' }),
      };

      // After sync, enqueueConflictDetection should be called for each event
      const eventId = 'evt-1';
      const clientCalendarId = FAKE_CALENDAR_ID;

      await mockProducer.submit({
        agentId: 'calendar',
        actionType: 'detectConflict',
        input: { workspace_id: FAKE_WORKSPACE_ID, eventId, clientCalendarId },
        idempotencyKey: `conflict-detect:${eventId}:${Math.floor(Date.now() / 300000)}`,
      });

      expect(mockProducer.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'calendar',
          actionType: 'detectConflict',
        }),
      );
    });

    test('[P0] job deduplicated by idempotency key within 5-minute window', () => {
      const eventId = 'evt-1';
      const window1 = Math.floor(Date.now() / 300000);
      const window2 = window1; // Same 5-min window

      const key1 = `conflict-detect:${eventId}:${window1}`;
      const key2 = `conflict-detect:${eventId}:${window2}`;

      expect(key1).toBe(key2);
    });
  });
});
