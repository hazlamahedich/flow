import { describe, it, expect } from 'vitest';
import { canGraduate, evaluateTransition, applyViolation } from '../src/graduation';

describe('graduation rules T1-T6', () => {
  describe('T1: supervised → confirm', () => {
    it('graduates when all thresholds met', () => {
      const result = canGraduate({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 7,
        totalAtCurrentLevel: 10,
        cooldownUntil: null,
        lastViolationAt: null,
      });
      expect(result).toBe(true);
    });

    it('does not graduate with insufficient score', () => {
      const result = canGraduate({
        currentLevel: 'supervised',
        score: 69,
        consecutiveSuccesses: 7,
        totalAtCurrentLevel: 10,
        cooldownUntil: null,
        lastViolationAt: null,
      });
      expect(result).toBe(false);
    });

    it('does not graduate with insufficient consecutive successes', () => {
      const result = canGraduate({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 6,
        totalAtCurrentLevel: 10,
        cooldownUntil: null,
        lastViolationAt: null,
      });
      expect(result).toBe(false);
    });

    it('does not graduate within cooldown', () => {
      const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const result = canGraduate({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 7,
        totalAtCurrentLevel: 10,
        cooldownUntil: future,
        lastViolationAt: null,
      });
      expect(result).toBe(false);
    });

    it('does not graduate with recent violation', () => {
      const recent = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = canGraduate({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 7,
        totalAtCurrentLevel: 10,
        cooldownUntil: null,
        lastViolationAt: recent,
      });
      expect(result).toBe(false);
    });
  });

  describe('T2: confirm → auto', () => {
    it('graduates when all thresholds met', () => {
      const result = canGraduate({
        currentLevel: 'confirm',
        score: 140,
        consecutiveSuccesses: 14,
        totalAtCurrentLevel: 20,
        cooldownUntil: null,
        lastViolationAt: null,
      });
      expect(result).toBe(true);
    });

    it('does not graduate with insufficient total at confirm', () => {
      const result = canGraduate({
        currentLevel: 'confirm',
        score: 140,
        consecutiveSuccesses: 14,
        totalAtCurrentLevel: 19,
        cooldownUntil: null,
        lastViolationAt: null,
      });
      expect(result).toBe(false);
    });
  });

  describe('T3: auto → confirm (soft violation)', () => {
    it('demotes to confirm on first soft violation at auto', () => {
      expect(applyViolation('auto', 'soft', 0)).toBe('confirm');
    });
  });

  describe('T4: auto → supervised (hard violation)', () => {
    it('demotes to supervised on hard violation at auto', () => {
      expect(applyViolation('auto', 'hard', 0)).toBe('supervised');
    });

    it('demotes to supervised on second soft in window', () => {
      expect(applyViolation('auto', 'soft', 1)).toBe('supervised');
    });
  });

  describe('T5: confirm → supervised (any violation)', () => {
    it('demotes confirm to supervised on soft violation', () => {
      expect(applyViolation('confirm', 'soft', 0)).toBe('supervised');
    });

    it('demotes confirm to supervised on hard violation', () => {
      expect(applyViolation('confirm', 'hard', 0)).toBe('supervised');
    });
  });

  describe('T6: manual override is unconditional', () => {
    it('evaluateTransition returns graduation result for supervised', () => {
      const result = evaluateTransition({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 7,
        totalAtCurrentLevel: 10,
        cooldownUntil: null,
        lastViolationAt: null,
      });
      expect(result.canGraduate).toBe(true);
      expect(result.targetLevel).toBe('confirm');
    });

    it('evaluateTransition returns no graduation when conditions not met', () => {
      const result = evaluateTransition({
        currentLevel: 'supervised',
        score: 10,
        consecutiveSuccesses: 2,
        totalAtCurrentLevel: 5,
        cooldownUntil: null,
        lastViolationAt: null,
      });
      expect(result.canGraduate).toBe(false);
      expect(result.targetLevel).toBeNull();
    });
  });
});
