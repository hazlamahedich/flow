import { describe, it, expect } from 'vitest';
import { applyViolation, evaluateContextShift } from '../src/graduation';

describe('graduation edge cases', () => {
  it('violation at supervised stays supervised', () => {
    expect(applyViolation('supervised', 'soft', 0)).toBe('supervised');
    expect(applyViolation('supervised', 'hard', 0)).toBe('supervised');
  });

  it('score floor at 0 — supervised stays supervised regardless', () => {
    expect(applyViolation('supervised', 'hard', 5)).toBe('supervised');
  });

  it('pre-check failure is instance-only — applyViolation does not change level for it', () => {
    expect(applyViolation('supervised', 'soft', 0)).toBe('supervised');
    expect(applyViolation('confirm', 'soft', 0)).toBe('supervised');
    expect(applyViolation('auto', 'soft', 0)).toBe('confirm');
  });

  it('context-shift T7 auto→confirm preserves some trust', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const result = evaluateContextShift('auto', thirtyOneDaysAgo);
    expect(result.shouldShift).toBe(true);
    expect(result.targetLevel).toBe('confirm');
  });

  it('context-shift T7 confirm→supervised', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const result = evaluateContextShift('confirm', thirtyOneDaysAgo);
    expect(result.shouldShift).toBe(true);
    expect(result.targetLevel).toBe('supervised');
  });

  it('context-shift for supervised = no suggestion', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const result = evaluateContextShift('supervised', thirtyOneDaysAgo);
    expect(result.shouldShift).toBe(false);
    expect(result.targetLevel).toBeNull();
  });

  it('context-shift does not trigger before 30 days', () => {
    const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const result = evaluateContextShift('auto', twentyNineDaysAgo);
    expect(result.shouldShift).toBe(false);
  });

  it('context-shift with null lastActiveAt returns no shift', () => {
    const result = evaluateContextShift('auto', null);
    expect(result.shouldShift).toBe(false);
  });
});
