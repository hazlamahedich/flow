import { describe, it, expect } from 'vitest';
import { duration, easing, reducedMotionDuration } from '../motion';

describe('motion durations', () => {
  it('has all 5 duration tokens', () => {
    const keys = Object.keys(duration);
    expect(keys).toEqual(['instant', 'fast', 'normal', 'expressive', 'ceremony']);
  });

  it('instant is 50ms', () => {
    expect(duration.instant).toBe('50ms');
  });

  it('fast is 100ms', () => {
    expect(duration.fast).toBe('100ms');
  });

  it('normal is 150ms', () => {
    expect(duration.normal).toBe('150ms');
  });

  it('expressive is 300ms', () => {
    expect(duration.expressive).toBe('300ms');
  });

  it('ceremony is 500ms', () => {
    expect(duration.ceremony).toBe('500ms');
  });
});

describe('easing functions', () => {
  it('has all 5 easing tokens', () => {
    const keys = Object.keys(easing);
    expect(keys).toEqual(['standard', 'decelerate', 'accelerate', 'spring', 'gentle']);
  });

  it('all use cubic-bezier format', () => {
    for (const value of Object.values(easing)) {
      expect(value).toMatch(/^cubic-bezier\(/);
    }
  });

  it('spring uses explicit values from AC-12', () => {
    expect(easing.spring).toBe('cubic-bezier(0.34, 1.56, 0.64, 1)');
  });
});

describe('reduced motion', () => {
  it('sets all durations to 0ms except ceremony', () => {
    expect(reducedMotionDuration.instant).toBe('0ms');
    expect(reducedMotionDuration.fast).toBe('0ms');
    expect(reducedMotionDuration.normal).toBe('0ms');
    expect(reducedMotionDuration.expressive).toBe('0ms');
  });

  it('ceremony is simplified to 100ms', () => {
    expect(reducedMotionDuration.ceremony).toBe('100ms');
  });
});
