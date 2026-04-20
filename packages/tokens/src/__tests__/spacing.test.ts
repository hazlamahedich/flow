import { describe, it, expect } from 'vitest';
import { spacing, trustDensity } from '../spacing';

describe('spacing scale', () => {
  it('has 4px base (space-1 = 4px)', () => {
    expect(spacing[1]).toBe('4px');
  });

  it('starts at 0', () => {
    expect(spacing[0]).toBe('0px');
  });

  it('goes up to 96px (space-24)', () => {
    expect(spacing[24]).toBe('96px');
  });

  it('has half-step increments', () => {
    expect(spacing[0.5]).toBe('2px');
    expect(spacing[1.5]).toBe('6px');
    expect(spacing[2.5]).toBe('10px');
  });

  it('all values end in px', () => {
    for (const value of Object.values(spacing)) {
      expect(value).toMatch(/^\d+px$/);
    }
  });
});

describe('trust density', () => {
  it('compact is 16px', () => {
    expect(trustDensity.compact).toBe('16px');
  });

  it('standard is 20px', () => {
    expect(trustDensity.standard).toBe('20px');
  });

  it('elevated is 28px', () => {
    expect(trustDensity.elevated).toBe('28px');
  });

  it('ceremony is 48px', () => {
    expect(trustDensity.ceremony).toBe('48px');
  });

  it('values are monotonically increasing (more space = more trust)', () => {
    const values = Object.values(trustDensity).map((v) => parseInt(v, 10));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });
});
