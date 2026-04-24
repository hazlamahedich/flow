import { describe, it, expect } from 'vitest';
import { applyViolationRollback } from '../src/rollback';

describe('rollback', () => {
  it('soft violation at auto → confirm', () => {
    expect(applyViolationRollback('auto', 'soft', 0)).toBe('confirm');
  });

  it('hard violation at auto → supervised', () => {
    expect(applyViolationRollback('auto', 'hard', 0)).toBe('supervised');
  });

  it('second soft in window at auto → supervised', () => {
    expect(applyViolationRollback('auto', 'soft', 1)).toBe('supervised');
  });

  it('violation at confirm → supervised', () => {
    expect(applyViolationRollback('confirm', 'soft', 0)).toBe('supervised');
  });

  it('violation at supervised stays supervised', () => {
    expect(applyViolationRollback('supervised', 'hard', 0)).toBe('supervised');
  });
});
