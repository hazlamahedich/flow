import { describe, it, expect } from 'vitest';
import {
  computeTimeEntryAmount,
  formatTimeEntryDescription,
  formatTimeEntryAmountDisplay,
} from '../time-entry-billing';

describe('computeTimeEntryAmount', () => {
  it('returns 0 for 0 minutes', () => {
    expect(computeTimeEntryAmount(0, 10000)).toBe(0);
  });

  it('rounds 1 minute correctly', () => {
    // $100/hr = 10000 cents.  10000 * (1/60) = 166.667 → 167
    expect(computeTimeEntryAmount(1, 10000)).toBe(167);
  });

  it('calculates 59 minutes', () => {
    // 10000 * 59/60 = 9833.333 → 9833
    expect(computeTimeEntryAmount(59, 10000)).toBe(9833);
  });

  it('calculates 60 minutes exactly', () => {
    expect(computeTimeEntryAmount(60, 10000)).toBe(10000);
  });

  it('calculates 61 minutes', () => {
    // 10000 * 61/60 = 10166.667 → 10167
    expect(computeTimeEntryAmount(61, 10000)).toBe(10167);
  });

  it('rounds half-up', () => {
    // 15000 * 1/60 = 250 → 250
    expect(computeTimeEntryAmount(1, 15000)).toBe(250);

    // 10000 * 7/60 = 1166.667 → 1167
    expect(computeTimeEntryAmount(7, 10000)).toBe(1167);
  });

  it('works with typical VA rate ($45/hr)', () => {
    // 4500 cents/hr, 30 min → 2250 cents
    expect(computeTimeEntryAmount(30, 4500)).toBe(2250);
  });

  it('throws on negative duration', () => {
    expect(() => computeTimeEntryAmount(-5, 10000)).toThrow(RangeError);
  });

  it('throws on zero hourly rate', () => {
    expect(() => computeTimeEntryAmount(10, 0)).toThrow(RangeError);
  });

  it('throws on negative hourly rate', () => {
    expect(() => computeTimeEntryAmount(10, -100)).toThrow(RangeError);
  });
});

describe('formatTimeEntryDescription', () => {
  it('includes notes and duration', () => {
    expect(formatTimeEntryDescription('Research for pitch deck', 45)).toBe(
      'Research for pitch deck (45 min)',
    );
  });

  it('only shows duration when no notes', () => {
    expect(formatTimeEntryDescription(null, 30)).toBe('(30 min)');
    expect(formatTimeEntryDescription(undefined, 60)).toBe('(60 min)');
  });
});

describe('formatTimeEntryAmountDisplay', () => {
  it('formats amount and duration', () => {
    expect(formatTimeEntryAmountDisplay(2250, 30)).toBe('$22.50 (30 min)');
  });

  it('shows $0 correctly', () => {
    expect(formatTimeEntryAmountDisplay(0, 0)).toBe('$0.00 (0 min)');
  });
});
