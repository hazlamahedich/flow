import { describe, it, expect } from 'vitest';
import { typography } from '../typography';

describe('typography scale', () => {
  it('has 9 font sizes (2xs through 3xl)', () => {
    const sizes = Object.keys(typography.fontSize);
    expect(sizes).toEqual(['2xs', 'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl']);
  });

  it('base font size is 14px (0.875rem)', () => {
    expect(typography.fontSize.base).toBe('0.875rem');
  });

  it('2xs is 11px', () => {
    expect(typography.fontSize['2xs']).toBe('0.6875rem');
  });

  it('3xl is 30px', () => {
    expect(typography.fontSize['3xl']).toBe('1.875rem');
  });

  it('sizes are monotonically increasing', () => {
    const values = Object.values(typography.fontSize).map((v) => parseFloat(v));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });

  it('has 5 line heights', () => {
    const heights = Object.keys(typography.lineHeight);
    expect(heights).toEqual(['none', 'tight', 'snug', 'normal', 'relaxed']);
  });

  it('has 4 font weights', () => {
    const weights = Object.keys(typography.fontWeight);
    expect(weights).toEqual(['regular', 'medium', 'semibold', 'bold']);
  });

  it('has 3 letter spacing options', () => {
    const spacings = Object.keys(typography.letterSpacing);
    expect(spacings).toEqual(['tight', 'normal', 'wide']);
  });

  it('has Inter as sans font', () => {
    expect(typography.fontFamily.sans).toBe('Inter');
  });

  it('has JetBrains Mono as mono font', () => {
    expect(typography.fontFamily.mono).toBe('JetBrains Mono');
  });
});
