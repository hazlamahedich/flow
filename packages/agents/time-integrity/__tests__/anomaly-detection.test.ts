import { describe, test, expect } from 'vitest';
import { detectGaps, detectOverlaps, detectLowHours } from '../anomaly-detection';
import type { TimeEntryForDetection } from '../anomaly-detection';
import { GAP_THRESHOLD_MINUTES, LOW_HOURS_TARGET } from '../schemas';

// ── helpers ──────────────────────────────────────────────────────────────────

function entry(
  overrides: Partial<TimeEntryForDetection> & Pick<TimeEntryForDetection, 'id' | 'date' | 'durationMinutes'>,
): TimeEntryForDetection {
  return { ...overrides };
}

function timedEntry(
  id: string,
  date: string,
  durationMinutes: number,
  startH: number,
  endH: number,
): TimeEntryForDetection {
  return { id, date, durationMinutes, startMinutes: startH * 60, endMinutes: endH * 60 };
}

// ── detectGaps ────────────────────────────────────────────────────────────────

describe('detectGaps', () => {
  test('returns empty for single entry on a day (no consecutive pair)', () => {
    const entries = [timedEntry('a', '2026-05-12', 60, 9, 10)];
    expect(detectGaps(entries, GAP_THRESHOLD_MINUTES)).toEqual([]);
  });

  test('returns empty when gap equals threshold (not strictly greater)', () => {
    const entries = [
      timedEntry('a', '2026-05-12', 60, 9, 10),
      timedEntry('b', '2026-05-12', 60, 11, 12),
    ];
    // gap = 60 min == threshold → not detected
    expect(detectGaps(entries, 60)).toEqual([]);
  });

  test('detects gap when gap > threshold', () => {
    const entries = [
      timedEntry('a', '2026-05-12', 60, 9, 10),
      timedEntry('b', '2026-05-12', 60, 12, 13),
    ];
    const result = detectGaps(entries, GAP_THRESHOLD_MINUTES);
    expect(result).toHaveLength(1);
    expect(result[0].anomalyType).toBe('gap');
    expect(result[0].affectedEntryIds.sort()).toEqual(['a', 'b'].sort());
    expect(result[0].payload.gapMinutes).toBe(120);
  });

  test('detects multiple gaps on same day', () => {
    const entries = [
      timedEntry('a', '2026-05-12', 60, 8, 9),
      timedEntry('b', '2026-05-12', 60, 12, 13),
      timedEntry('c', '2026-05-12', 60, 17, 18),
    ];
    const result = detectGaps(entries, 60);
    expect(result).toHaveLength(2);
  });

  test('returns empty when entries lack startMinutes/endMinutes', () => {
    const entries = [
      entry({ id: 'a', date: '2026-05-12', durationMinutes: 60 }),
      entry({ id: 'b', date: '2026-05-12', durationMinutes: 60 }),
    ];
    expect(detectGaps(entries, GAP_THRESHOLD_MINUTES)).toEqual([]);
  });

  test('gaps on different days are independent', () => {
    const entries = [
      timedEntry('a', '2026-05-11', 60, 9, 10),
      timedEntry('b', '2026-05-11', 60, 12, 13),
      timedEntry('c', '2026-05-12', 60, 9, 10),
    ];
    const result = detectGaps(entries, 60);
    expect(result).toHaveLength(1);
    expect(result[0].payload.date).toBe('2026-05-11');
  });

  test('signal_key is stable for same pair regardless of entry order', () => {
    const e1 = [timedEntry('a', '2026-05-12', 60, 9, 10), timedEntry('b', '2026-05-12', 60, 12, 13)];
    const e2 = [timedEntry('b', '2026-05-12', 60, 12, 13), timedEntry('a', '2026-05-12', 60, 9, 10)];
    expect(detectGaps(e1, 60)[0].signalKey).toBe(detectGaps(e2, 60)[0].signalKey);
  });
});

// ── detectOverlaps ────────────────────────────────────────────────────────────

describe('detectOverlaps', () => {
  test('no overlap for non-overlapping entries', () => {
    const entries = [
      timedEntry('a', '2026-05-12', 60, 9, 10),
      timedEntry('b', '2026-05-12', 60, 10, 11),
    ];
    expect(detectOverlaps(entries)).toEqual([]);
  });

  test('no overlap for adjacent entries (end == start)', () => {
    const entries = [
      timedEntry('a', '2026-05-12', 60, 9, 10),
      timedEntry('b', '2026-05-12', 60, 10, 11),
    ];
    expect(detectOverlaps(entries)).toEqual([]);
  });

  test('detects partial overlap', () => {
    const entries = [
      timedEntry('a', '2026-05-12', 90, 9, 10, ),  // 9:00–10:30
      timedEntry('b', '2026-05-12', 60, 10, 11),   // 10:00–11:00
    ];
    // Override end for 'a' — use raw startMinutes/endMinutes
    entries[0].endMinutes = 10 * 60 + 30; // 10:30
    const result = detectOverlaps(entries);
    expect(result).toHaveLength(1);
    expect(result[0].anomalyType).toBe('overlap');
  });

  test('detects full containment overlap', () => {
    const entries = [
      timedEntry('a', '2026-05-12', 240, 9, 17),  // 9:00–17:00
      timedEntry('b', '2026-05-12', 60, 11, 12),  // 11:00–12:00 fully inside a
    ];
    const result = detectOverlaps(entries);
    expect(result).toHaveLength(1);
  });

  test('returns empty when entries lack startMinutes/endMinutes', () => {
    const entries = [
      entry({ id: 'a', date: '2026-05-12', durationMinutes: 60 }),
      entry({ id: 'b', date: '2026-05-12', durationMinutes: 60 }),
    ];
    expect(detectOverlaps(entries)).toEqual([]);
  });

  test('does not emit duplicate signals for same pair', () => {
    const entries = [
      timedEntry('a', '2026-05-12', 90, 9, 11),
      timedEntry('b', '2026-05-12', 90, 10, 12),
    ];
    expect(detectOverlaps(entries)).toHaveLength(1);
  });

  test('entries on different days do not overlap each other', () => {
    const entries = [
      timedEntry('a', '2026-05-11', 60, 9, 11),
      timedEntry('b', '2026-05-12', 60, 10, 12),
    ];
    expect(detectOverlaps(entries)).toEqual([]);
  });
});

// ── detectLowHours ────────────────────────────────────────────────────────────

describe('detectLowHours', () => {
  test('flags day below target', () => {
    const entries = [entry({ id: 'a', date: '2026-05-12', durationMinutes: 90 })];
    const result = detectLowHours(entries, LOW_HOURS_TARGET);
    expect(result).toHaveLength(1);
    expect(result[0].anomalyType).toBe('low-hours');
    expect(result[0].payload.totalMinutes).toBe(90);
  });

  test('does not flag day at exactly target (target = 4h = 240 min)', () => {
    const entries = [entry({ id: 'a', date: '2026-05-12', durationMinutes: 240 })];
    expect(detectLowHours(entries, LOW_HOURS_TARGET)).toEqual([]);
  });

  test('does not flag day above target', () => {
    const entries = [entry({ id: 'a', date: '2026-05-12', durationMinutes: 480 })];
    expect(detectLowHours(entries, LOW_HOURS_TARGET)).toEqual([]);
  });

  test('sums entries across same day', () => {
    const entries = [
      entry({ id: 'a', date: '2026-05-12', durationMinutes: 100 }),
      entry({ id: 'b', date: '2026-05-12', durationMinutes: 100 }),
    ];
    // total = 200 < 240 → flagged
    const result = detectLowHours(entries, LOW_HOURS_TARGET);
    expect(result).toHaveLength(1);
    expect(result[0].affectedEntryIds).toHaveLength(2);
  });

  test('sums across same day — above threshold — not flagged', () => {
    const entries = [
      entry({ id: 'a', date: '2026-05-12', durationMinutes: 130 }),
      entry({ id: 'b', date: '2026-05-12', durationMinutes: 130 }),
    ];
    // total = 260 > 240 → not flagged
    expect(detectLowHours(entries, LOW_HOURS_TARGET)).toEqual([]);
  });

  test('flags multiple low-hours days independently', () => {
    const entries = [
      entry({ id: 'a', date: '2026-05-11', durationMinutes: 60 }),
      entry({ id: 'b', date: '2026-05-12', durationMinutes: 60 }),
      entry({ id: 'c', date: '2026-05-13', durationMinutes: 480 }),
    ];
    const result = detectLowHours(entries, LOW_HOURS_TARGET);
    expect(result).toHaveLength(2);
    const dates = result.map((s) => s.payload.date as string).sort();
    expect(dates).toEqual(['2026-05-11', '2026-05-12']);
  });

  test('affected_entry_ids are sorted for consistent signal_key', () => {
    const entries = [
      entry({ id: 'z-uuid', date: '2026-05-12', durationMinutes: 30 }),
      entry({ id: 'a-uuid', date: '2026-05-12', durationMinutes: 30 }),
    ];
    const result = detectLowHours(entries, LOW_HOURS_TARGET);
    expect(result[0].affectedEntryIds).toEqual(['a-uuid', 'z-uuid']);
  });

  test('NFR02: 500 entries across 90 days processed in < 30s', () => {
    const entries: TimeEntryForDetection[] = [];
    const base = new Date('2026-02-11');
    for (let i = 0; i < 500; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + Math.floor(i / 6));
      const dateStr = d.toISOString().slice(0, 10);
      const isGap = i % 10 === 0;
      entries.push({
        id: `entry-${i}`,
        date: dateStr,
        durationMinutes: isGap ? 10 : 60,
        startMinutes: (i % 8) * 60,
        endMinutes: (i % 8) * 60 + (isGap ? 10 : 60),
      });
    }

    const start = Date.now();
    const gaps = detectGaps(entries, GAP_THRESHOLD_MINUTES);
    const overlaps = detectOverlaps(entries);
    const lowHours = detectLowHours(entries, LOW_HOURS_TARGET);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(30_000);
    expect(gaps.length + overlaps.length + lowHours.length).toBeGreaterThan(0);
  });
});
