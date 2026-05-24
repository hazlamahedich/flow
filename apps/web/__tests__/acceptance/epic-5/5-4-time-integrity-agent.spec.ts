import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectGaps,
  detectOverlaps,
  detectLowHours,
  type TimeEntryForDetection,
} from '@flow/agents/time-integrity/anomaly-detection';
import { GAP_THRESHOLD_MINUTES, LOW_HOURS_TARGET, timeIntegrityInputSchema } from '@flow/agents/time-integrity/schemas';
import { getBossInstance, setBossInstance, clearBossInstance } from '@flow/agents/orchestrator/boss-di';
import { isSupabaseAvailable } from '@flow/test-utils';

function buildTimeEntry(overrides: Partial<TimeEntryForDetection> = {}): TimeEntryForDetection {
  return {
    id: crypto.randomUUID(),
    date: '2026-05-09',
    durationMinutes: 60,
    ...overrides,
  };
}

function buildTimedEntry(
  startMinutes: number,
  endMinutes: number,
  overrides: Partial<TimeEntryForDetection> = {},
): TimeEntryForDetection {
  return {
    ...buildTimeEntry(overrides),
    startMinutes,
    endMinutes,
  };
}

describe('Story 5.4: Time Integrity Agent', () => {
  describe('AC1: Anomaly detection — gaps', () => {
    test('[P0] [5.4-AC1-001] should detect gap between entries on same day', () => {
      const entries = [
        buildTimedEntry(540, 600, { id: 'a' }),
        buildTimedEntry(720, 780, { id: 'b' }),
      ];
      const signals = detectGaps(entries, GAP_THRESHOLD_MINUTES);
      expect(signals).toHaveLength(1);
      expect(signals[0].anomalyType).toBe('gap');
      expect(signals[0].payload.gapMinutes).toBe(120);
    });

    test('[P0] [5.4-AC1-002] should not flag gap below threshold', () => {
      const entries = [
        buildTimedEntry(540, 600, { id: 'a' }),
        buildTimedEntry(610, 670, { id: 'b' }),
      ];
      const signals = detectGaps(entries, GAP_THRESHOLD_MINUTES);
      expect(signals).toHaveLength(0);
    });

    test('[P1] [5.4-AC1-003] should return empty when entries lack start/end times', () => {
      const entries = [
        buildTimeEntry({ date: '2026-05-09' }),
        buildTimeEntry({ date: '2026-05-09' }),
      ];
      const signals = detectGaps(entries, GAP_THRESHOLD_MINUTES);
      expect(signals).toHaveLength(0);
    });
  });

  describe('AC2: Anomaly detection — overlaps', () => {
    test('[P0] [5.4-AC2-001] should detect overlapping time entries', () => {
      const entries = [
        buildTimedEntry(540, 630, { id: 'a' }),
        buildTimedEntry(600, 660, { id: 'b' }),
      ];
      const signals = detectOverlaps(entries);
      expect(signals).toHaveLength(1);
      expect(signals[0].anomalyType).toBe('overlap');
    });

    test('[P0] [5.4-AC2-002] should not flag adjacent non-overlapping entries', () => {
      const entries = [
        buildTimedEntry(540, 600, { id: 'a' }),
        buildTimedEntry(600, 660, { id: 'b' }),
      ];
      const signals = detectOverlaps(entries);
      expect(signals).toHaveLength(0);
    });

    test('[P1] [5.4-AC2-003] should detect multiple overlaps across pairs', () => {
      const entries = [
        buildTimedEntry(540, 630, { id: 'a' }),
        buildTimedEntry(600, 660, { id: 'b' }),
        buildTimedEntry(620, 700, { id: 'c' }),
      ];
      const signals = detectOverlaps(entries);
      expect(signals.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('AC3: Anomaly detection — low-hours days', () => {
    test('[P0] [5.4-AC3-001] should flag days with less than target hours tracked', () => {
      const entries = [
        buildTimeEntry({ date: '2026-05-09', durationMinutes: 90 }),
      ];
      const signals = detectLowHours(entries, LOW_HOURS_TARGET);
      expect(signals).toHaveLength(1);
      expect(signals[0].anomalyType).toBe('low-hours');
      expect(signals[0].payload.totalMinutes).toBe(90);
      expect(signals[0].payload.targetMinutes).toBe(LOW_HOURS_TARGET * 60);
    });

    test('[P1] [5.4-AC3-002] should not flag days at exactly target hours', () => {
      const targetMinutes = LOW_HOURS_TARGET * 60;
      const entries = [
        buildTimeEntry({ date: '2026-05-09', durationMinutes: targetMinutes }),
      ];
      const signals = detectLowHours(entries, LOW_HOURS_TARGET);
      expect(signals).toHaveLength(0);
    });

    test('[P1] [5.4-AC3-003] should aggregate multiple entries on same day', () => {
      const entries = [
        buildTimeEntry({ date: '2026-05-09', durationMinutes: 60 }),
        buildTimeEntry({ date: '2026-05-09', durationMinutes: 60 }),
        buildTimeEntry({ date: '2026-05-09', durationMinutes: 60 }),
      ];
      const signals = detectLowHours(entries, LOW_HOURS_TARGET);
      expect(signals).toHaveLength(1);
      expect(signals[0].payload.totalMinutes).toBe(180);
    });
  });

  describe('AC4: PgBoss DI (not globalThis.getBoss)', () => {
    afterEach(() => {
      clearBossInstance();
    });

    test('[P0] [5.4-AC4-001] should throw if boss not initialized', () => {
      clearBossInstance();
      expect(() => getBossInstance()).toThrow('PgBoss instance not initialized');
    });

    test('[P0] [5.4-AC4-002] should return instance after setBossInstance', () => {
      const mockBoss = { start: vi.fn(), stop: vi.fn() } as unknown as import('pg-boss').PgBoss;
      setBossInstance(mockBoss);
      expect(getBossInstance()).toBe(mockBoss);
    });

    test('[P0] [5.4-AC4-003] should clear instance on clearBossInstance', () => {
      const mockBoss = { start: vi.fn(), stop: vi.fn() } as unknown as import('pg-boss').PgBoss;
      setBossInstance(mockBoss);
      expect(getBossInstance()).toBe(mockBoss);
      clearBossInstance();
      expect(() => getBossInstance()).toThrow('PgBoss instance not initialized');
    });
  });

  describe('AC5: Time integrity input schema validation', () => {
    test('[P0] [5.4-AC5-001] should validate time integrity input schema', () => {
      const valid = { workspaceId: crypto.randomUUID(), sweepDate: '2026-05-09' };
      const result = timeIntegrityInputSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    test('[P0] [5.4-AC5-002] should reject input with missing workspaceId', () => {
      const invalid = { sweepDate: '2026-05-09' };
      const result = timeIntegrityInputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    test('[P1] [5.4-AC5-003] should reject input with invalid date format', () => {
      const invalid = { workspaceId: crypto.randomUUID(), sweepDate: 'not-a-date' };
      const result = timeIntegrityInputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
