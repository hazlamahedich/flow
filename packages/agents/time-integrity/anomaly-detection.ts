import type { AnomalySignal, AnomalyType } from './schemas';
import { GAP_THRESHOLD_MINUTES, LOW_HOURS_TARGET } from './schemas';

// P11: constants are re-exported from schemas.ts — import from there, not here

/** Minimal entry shape needed for anomaly detection. */
export interface TimeEntryForDetection {
  id: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  startMinutes?: number; // minutes from midnight (optional — requires schema with start_time)
  endMinutes?: number; // minutes from midnight (optional — requires schema with end_time)
}

/** Stable idempotency key: [anomalyType, ...sortedIds].join(':') */
function buildSignalKey(anomalyType: AnomalyType, entryIds: string[]): string {
  return [anomalyType, ...[...entryIds].sort()].join(':');
}

function groupByDate(
  entries: TimeEntryForDetection[],
): Map<string, TimeEntryForDetection[]> {
  const map = new Map<string, TimeEntryForDetection[]>();
  for (const entry of entries) {
    const group = map.get(entry.date) ?? [];
    group.push(entry);
    map.set(entry.date, group);
  }
  return map;
}

/**
 * Detects gaps between consecutive entries on the same day.
 * Requires entries to have startMinutes/endMinutes; returns [] when those are absent.
 */
export function detectGaps(
  entries: TimeEntryForDetection[],
  thresholdMinutes: number = GAP_THRESHOLD_MINUTES,
): AnomalySignal[] {
  const byDay = groupByDate(entries);
  const signals: AnomalySignal[] = [];

  for (const [date, dayEntries] of byDay) {
    const withTimes = dayEntries.filter(
      (
        e,
      ): e is TimeEntryForDetection & {
        startMinutes: number;
        endMinutes: number;
      } => e.startMinutes !== undefined && e.endMinutes !== undefined,
    );
    if (withTimes.length < 2) continue;

    const sorted = [...withTimes].sort(
      (a, b) => a.startMinutes - b.startMinutes,
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapMinutes = sorted[i + 1]!.startMinutes - sorted[i]!.endMinutes;
      if (gapMinutes > thresholdMinutes) {
        const ids = [sorted[i]!.id, sorted[i + 1]!.id];
        signals.push({
          anomalyType: 'gap',
          affectedEntryIds: [...ids].sort(),
          signalKey: buildSignalKey('gap', ids),
          payload: { date, gapMinutes, thresholdMinutes },
        });
      }
    }
  }
  return signals;
}

/**
 * Detects temporal overlaps between entries on the same day.
 * Requires entries to have startMinutes/endMinutes; returns [] when those are absent.
 */
export function detectOverlaps(
  entries: TimeEntryForDetection[],
): AnomalySignal[] {
  const byDay = groupByDate(entries);
  const signals: AnomalySignal[] = [];
  // Track pairs already emitted to avoid duplicates when multiple pairs overlap
  const seen = new Set<string>();

  for (const [date, dayEntries] of byDay) {
    const withTimes = dayEntries.filter(
      (
        e,
      ): e is TimeEntryForDetection & {
        startMinutes: number;
        endMinutes: number;
      } => e.startMinutes !== undefined && e.endMinutes !== undefined,
    );

    for (let i = 0; i < withTimes.length; i++) {
      for (let j = i + 1; j < withTimes.length; j++) {
        const a = withTimes[i]!;
        const b = withTimes[j]!;
        const overlaps =
          a.endMinutes > b.startMinutes && b.endMinutes > a.startMinutes;
        if (!overlaps) continue;

        const ids = [a.id, b.id];
        const key = buildSignalKey('overlap', ids);
        if (seen.has(key)) continue;
        seen.add(key);

        signals.push({
          anomalyType: 'overlap',
          affectedEntryIds: [...ids].sort(),
          signalKey: key,
          payload: { date },
        });
      }
    }
  }
  return signals;
}

/**
 * Detects days where total logged hours fall below the target.
 */
export function detectLowHours(
  entries: TimeEntryForDetection[],
  targetHours: number = LOW_HOURS_TARGET,
): AnomalySignal[] {
  const byDay = groupByDate(entries);
  const signals: AnomalySignal[] = [];
  const targetMinutes = targetHours * 60;

  for (const [date, dayEntries] of byDay) {
    const totalMinutes = dayEntries.reduce(
      (sum, e) => sum + e.durationMinutes,
      0,
    );
    if (totalMinutes < targetMinutes) {
      const ids = dayEntries.map((e) => e.id);
      signals.push({
        anomalyType: 'low-hours',
        affectedEntryIds: [...ids].sort(),
        // P17: key is 'low-hours' only (no entry IDs) — prevents duplicate signals when
        // entries are added/removed from a low-hours day between sweeps; uniqueness is
        // enforced by (workspace_id, sweep_date, signal_key) where sweep_date = this date
        signalKey: 'low-hours',
        payload: { date, totalMinutes, targetMinutes },
      });
    }
  }
  return signals;
}
