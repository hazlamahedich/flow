import { describe, it, expect } from 'vitest';
import { canGraduate, COOLDOWN_DAYS, CONTEXT_SHIFT_COOLDOWN_DAYS } from '../src/graduation';
import { evaluateContextShift } from '../src/graduation';

describe('graduation cooldown', () => {
  it('blocks graduation during cooldown', () => {
    const cooldown = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    expect(
      canGraduate({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 7,
        totalAtCurrentLevel: 10,
        cooldownUntil: cooldown,
        lastViolationAt: null,
      }),
    ).toBe(false);
  });

  it('allows graduation just past cooldown boundary', () => {
    const cooldown = new Date(Date.now() - 1 * 60 * 1000);
    expect(
      canGraduate({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 7,
        totalAtCurrentLevel: 10,
        cooldownUntil: cooldown,
        lastViolationAt: null,
      }),
    ).toBe(true);
  });

  it('blocks graduation at 6d23h59m of 7d cooldown', () => {
    const cooldown = new Date(Date.now() + 1 * 60 * 1000);
    expect(
      canGraduate({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 7,
        totalAtCurrentLevel: 10,
        cooldownUntil: cooldown,
        lastViolationAt: null,
      }),
    ).toBe(false);
  });

  it('allows graduation after full 7d cooldown', () => {
    const cooldown = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000 - 60000);
    expect(
      canGraduate({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 7,
        totalAtCurrentLevel: 10,
        cooldownUntil: cooldown,
        lastViolationAt: null,
      }),
    ).toBe(true);
  });

  it('auto level never graduates further', () => {
    expect(
      canGraduate({
        currentLevel: 'auto',
        score: 200,
        consecutiveSuccesses: 100,
        totalAtCurrentLevel: 100,
        cooldownUntil: null,
        lastViolationAt: null,
      }),
    ).toBe(false);
  });

  it('null cooldown does not block graduation', () => {
    expect(
      canGraduate({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 7,
        totalAtCurrentLevel: 10,
        cooldownUntil: null,
        lastViolationAt: null,
      }),
    ).toBe(true);
  });

  it('past cooldown allows graduation', () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    expect(
      canGraduate({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 7,
        totalAtCurrentLevel: 10,
        cooldownUntil: past,
        lastViolationAt: null,
      }),
    ).toBe(true);
  });

  it('violation within 7 days blocks supervised→confirm', () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    expect(
      canGraduate({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 7,
        totalAtCurrentLevel: 10,
        cooldownUntil: null,
        lastViolationAt: recent,
      }),
    ).toBe(false);
  });

  it('violation within 14 days blocks confirm→auto', () => {
    const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    expect(
      canGraduate({
        currentLevel: 'confirm',
        score: 140,
        consecutiveSuccesses: 14,
        totalAtCurrentLevel: 20,
        cooldownUntil: null,
        lastViolationAt: recent,
      }),
    ).toBe(false);
  });

  it('violation older than window allows graduation', () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(
      canGraduate({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 7,
        totalAtCurrentLevel: 10,
        cooldownUntil: null,
        lastViolationAt: old,
      }),
    ).toBe(true);
  });

  it('context-shift applies 3-day re-graduation cooldown', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const result = evaluateContextShift('auto', thirtyOneDaysAgo);
    expect(result.shouldShift).toBe(true);
    expect(result.targetLevel).toBe('confirm');
    expect(CONTEXT_SHIFT_COOLDOWN_DAYS).toBe(3);
  });
});
