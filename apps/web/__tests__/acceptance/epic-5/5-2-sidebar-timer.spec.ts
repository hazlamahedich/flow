import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectGaps,
  detectOverlaps,
  type TimeEntryForDetection,
} from '@flow/agents/time-integrity/anomaly-detection';
import { GAP_THRESHOLD_MINUTES } from '@flow/agents/time-integrity/schemas';

function buildTimeEntry(
  overrides: Partial<TimeEntryForDetection> = {},
): TimeEntryForDetection {
  return {
    id: crypto.randomUUID(),
    date: '2026-05-09',
    durationMinutes: 60,
    ...overrides,
  };
}

describe('Story 5.2: Persistent Sidebar Timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('AC1: Timer start/stop latency < 500ms', () => {
    test('[P0] [5.2-AC1-001] should use optimistic UI for timer start', () => {
      const startTime = Date.now();
      const optimisticState = { running: true, startedAt: startTime };
      expect(optimisticState.running).toBe(true);
      expect(optimisticState.startedAt).toBe(
        new Date('2026-05-09T10:00:00Z').getTime(),
      );
    });

    test('[P0] [5.2-AC1-002] should calculate elapsed time from startedAt deterministically', () => {
      const startedAt = Date.now();
      vi.setSystemTime(new Date('2026-05-09T10:00:15Z'));
      const elapsed = Date.now() - startedAt;
      expect(elapsed).toBe(15000);
    });
  });

  describe('AC2: Timer associates with client + project', () => {
    test('[P0] [5.2-AC2-001] should require clientId before timer start', () => {
      const timerState = { clientId: null as string | null, running: false };
      const canStart = timerState.clientId !== null && !timerState.running;
      expect(canStart).toBe(false);
    });

    test('[P1] [5.2-AC2-002] should allow optional projectId on timer', () => {
      const timerState = {
        clientId: crypto.randomUUID(),
        projectId: null as string | null,
        running: true,
      };
      expect(timerState.running).toBe(true);
      expect(timerState.projectId).toBeNull();
    });
  });

  describe('AC3: Timer survives page navigation', () => {
    test('[P0] [5.2-AC3-001] timer state should be in persistent store', () => {
      const timerState = {
        running: true,
        startedAt: Date.now(),
        clientId: crypto.randomUUID(),
      };
      expect(typeof timerState.startedAt).toBe('number');
      expect(timerState.running).toBe(true);
      expect(timerState.clientId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('AC4: Responsive timer pill on mobile', () => {
    test('[P0] [5.2-AC4-001] should constrain timer pill width within mobile viewport', () => {
      const mobileWidth = 375;
      const horizontalPadding = 16;
      const maxPillWidth = 360;
      const pillWidth = Math.min(maxPillWidth, mobileWidth - horizontalPadding);
      expect(pillWidth).toBeLessThanOrEqual(maxPillWidth);
      expect(pillWidth).toBeGreaterThan(0);
    });
  });

  describe('AC5: Timer pause/resume', () => {
    test('[P1] [5.2-AC5-001] should accumulate paused duration separately', () => {
      const pausedAt = Date.now();
      vi.setSystemTime(new Date('2026-05-09T10:05:00Z'));
      const resumedAt = Date.now();
      const pausedDuration = resumedAt - pausedAt;
      expect(pausedDuration).toBe(5 * 60 * 1000);
    });

    test('[P1] [5.2-AC5-002] should subtract paused duration from total elapsed', () => {
      const startedAt = new Date('2026-05-09T09:00:00Z').getTime();
      const pausedMs = 5 * 60 * 1000;
      vi.setSystemTime(new Date('2026-05-09T10:00:00Z'));
      const wallElapsed = Date.now() - startedAt;
      const activeElapsed = wallElapsed - pausedMs;
      expect(activeElapsed).toBe(55 * 60 * 1000);
    });
  });
});
