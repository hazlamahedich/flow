import { describe, test, expect } from 'vitest';
import { mapRawEntryToDetection } from '../executor';

describe('executor entry mapping', () => {
  test('maps start_minutes', () => {
    const row = {
      id: 'a',
      date: '2026-05-12',
      duration_minutes: 480,
      start_minutes: 540,
      end_minutes: 1020,
    };
    const entry = mapRawEntryToDetection(row);
    expect(entry.startMinutes).toBe(540);
  });

  test('maps end_minutes', () => {
    const row = {
      id: 'a',
      date: '2026-05-12',
      duration_minutes: 480,
      start_minutes: 540,
      end_minutes: 1020,
    };
    const entry = mapRawEntryToDetection(row);
    expect(entry.endMinutes).toBe(1020);
  });

  test('null start_minutes → undefined', () => {
    const row = {
      id: 'a',
      date: '2026-05-12',
      duration_minutes: 120,
      start_minutes: null,
      end_minutes: null,
    };
    const entry = mapRawEntryToDetection(row);
    expect(entry.startMinutes).toBeUndefined();
  });

  test('null end_minutes → undefined', () => {
    const row = {
      id: 'a',
      date: '2026-05-12',
      duration_minutes: 120,
      start_minutes: null,
      end_minutes: null,
    };
    const entry = mapRawEntryToDetection(row);
    expect(entry.endMinutes).toBeUndefined();
  });

  test('both null → both undefined', () => {
    const row = {
      id: 'a',
      date: '2026-05-12',
      duration_minutes: 60,
      start_minutes: null,
      end_minutes: null,
    };
    const entry = mapRawEntryToDetection(row);
    expect(entry.startMinutes).toBeUndefined();
    expect(entry.endMinutes).toBeUndefined();
  });
});
