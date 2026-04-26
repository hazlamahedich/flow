import { describe, it, expect } from 'vitest';
import { numericToMinutes, minutesToNumericStr, calculateThresholdMinutes, isScopeCreep } from '../numeric-helpers';

describe('numericToMinutes', () => {
  it('converts "40.50" to 2430 minutes', () => {
    expect(numericToMinutes('40.50')).toBe(2430);
  });

  it('converts "1.00" to 60 minutes', () => {
    expect(numericToMinutes('1.00')).toBe(60);
  });

  it('converts "0.50" to 30 minutes', () => {
    expect(numericToMinutes('0.50')).toBe(30);
  });

  it('returns 0 for null', () => {
    expect(numericToMinutes(null)).toBe(0);
  });

  it('returns 0 for "0"', () => {
    expect(numericToMinutes('0')).toBe(0);
  });

  it('handles integer hours "30" as 1800 minutes', () => {
    expect(numericToMinutes('30')).toBe(1800);
  });
});

describe('minutesToNumericStr', () => {
  it('converts 2430 minutes to "40.50"', () => {
    expect(minutesToNumericStr(2430)).toBe('40.50');
  });

  it('converts 60 minutes to "1.00"', () => {
    expect(minutesToNumericStr(60)).toBe('1.00');
  });

  it('converts 30 minutes to "0.50"', () => {
    expect(minutesToNumericStr(30)).toBe('0.50');
  });

  it('converts 0 minutes to "0.00"', () => {
    expect(minutesToNumericStr(0)).toBe('0.00');
  });
});

describe('calculateThresholdMinutes', () => {
  it('calculates 90% of 40 hours = 2160 minutes', () => {
    expect(calculateThresholdMinutes('40.00')).toBe(2160);
  });

  it('calculates 90% of 30 hours = 1620 minutes', () => {
    expect(calculateThresholdMinutes('30.00')).toBe(1620);
  });

  it('calculates 90% of 10.5 hours = 567 minutes', () => {
    expect(calculateThresholdMinutes('10.50')).toBe(567);
  });

  it('returns null for null input', () => {
    expect(calculateThresholdMinutes(null)).toBe(null);
  });

  it('returns null for "0"', () => {
    expect(calculateThresholdMinutes('0')).toBe(null);
  });

  it('rounds down: 90% of 100 hours = 5400 (exact)', () => {
    expect(calculateThresholdMinutes('100.00')).toBe(5400);
  });

  it('handles 90% boundary: 90% of 1 hour = 54 minutes', () => {
    expect(calculateThresholdMinutes('1.00')).toBe(54);
  });
});

describe('isScopeCreep', () => {
  it('returns true when tracked equals threshold', () => {
    expect(isScopeCreep(2160, 2160)).toBe(true);
  });

  it('returns true when tracked exceeds threshold', () => {
    expect(isScopeCreep(2200, 2160)).toBe(true);
  });

  it('returns false when tracked is below threshold', () => {
    expect(isScopeCreep(2159, 2160)).toBe(false);
  });

  it('returns false for null threshold', () => {
    expect(isScopeCreep(9999, null)).toBe(false);
  });

  it('returns false for zero tracked minutes', () => {
    expect(isScopeCreep(0, 2160)).toBe(false);
  });

  it('returns true at exactly 89% boundary (below 90)', () => {
    expect(isScopeCreep(2159, 2160)).toBe(false);
  });

  it('returns true at exactly 90%', () => {
    expect(isScopeCreep(2160, 2160)).toBe(true);
  });

  it('returns true at exactly 91%', () => {
    expect(isScopeCreep(2200, 2160)).toBe(true);
  });
});

describe('round trip: numericToMinutes -> minutesToNumericStr', () => {
  it('preserves values for common hour amounts', () => {
    const hours = ['10.00', '20.00', '40.00', '100.00'];
    for (const h of hours) {
      const mins = numericToMinutes(h);
      const back = minutesToNumericStr(mins);
      expect(back).toBe(h);
    }
  });

  it('preserves fractional hours', () => {
    const hours = ['0.50', '1.50', '10.50'];
    for (const h of hours) {
      const mins = numericToMinutes(h);
      const back = minutesToNumericStr(mins);
      expect(back).toBe(h);
    }
  });
});
