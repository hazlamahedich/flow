import { describe, it, expect } from 'vitest';
import { deriveBadgeState, assertValidBadgeTransition, InvalidTransitionError } from '../src/badge-state';
import type { TrustMatrixEntry } from '../src/types';

function makeEntry(overrides: Partial<TrustMatrixEntry> = {}): TrustMatrixEntry {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    workspaceId: '00000000-0000-0000-0000-000000000002',
    agentId: 'inbox',
    actionType: 'general',
    currentLevel: 'supervised',
    score: 10,
    totalExecutions: 5,
    successfulExecutions: 4,
    consecutiveSuccesses: 2,
    violationCount: 0,
    lastTransitionAt: new Date('2025-01-01T00:00:00Z'),
    lastViolationAt: null,
    cooldownUntil: null,
    version: 1,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('deriveBadgeState error paths', () => {
  it('handles zero score gracefully', () => {
    const state = deriveBadgeState(makeEntry({ score: 0 }), new Date());
    expect(state).toBe('supervised');
  });

  it('handles max score at supervised level', () => {
    const state = deriveBadgeState(makeEntry({ score: 200, currentLevel: 'supervised', consecutiveSuccesses: 20 }), new Date());
    expect(state).toBe('promoting');
  });

  it('handles confirm level without promoting threshold', () => {
    const state = deriveBadgeState(makeEntry({ score: 100, currentLevel: 'confirm', consecutiveSuccesses: 5, totalExecutions: 10 }), new Date());
    expect(state).toBe('confirm');
  });

  it('handles auto level with exactly 30 days', () => {
    const now = new Date('2025-02-01T00:00:00Z');
    const state = deriveBadgeState(makeEntry({ currentLevel: 'auto', lastTransitionAt: new Date('2025-01-02T00:00:00Z') }), now);
    expect(state).toBe('stick_time');
  });

  it('handles auto level with 29 days (not yet stick_time)', () => {
    const now = new Date('2025-01-30T00:00:00Z');
    const state = deriveBadgeState(makeEntry({ currentLevel: 'auto', lastTransitionAt: new Date('2025-01-01T00:00:00Z') }), now);
    expect(state).toBe('auto');
  });

  it('handles supervised entry with high violations but high score', () => {
    const state = deriveBadgeState(makeEntry({ score: 80, consecutiveSuccesses: 8, violationCount: 99 }), new Date());
    expect(state).toBe('promoting');
  });

  it('handles very recent lastTransitionAt', () => {
    const now = new Date();
    const state = deriveBadgeState(makeEntry({ currentLevel: 'auto', lastTransitionAt: now }), now);
    expect(state).toBe('auto');
  });

  it('handles supervised with exactly threshold score (70) and consecutive (7)', () => {
    const state = deriveBadgeState(makeEntry({ score: 70, consecutiveSuccesses: 7 }), new Date());
    expect(state).toBe('promoting');
  });

  it('handles confirm with score 139 (below promoting)', () => {
    const state = deriveBadgeState(makeEntry({ currentLevel: 'confirm', score: 139, consecutiveSuccesses: 14, totalExecutions: 25 }), new Date());
    expect(state).toBe('confirm');
  });

  it('handles confirm with consecutive 13 (below promoting)', () => {
    const state = deriveBadgeState(makeEntry({ currentLevel: 'confirm', score: 150, consecutiveSuccesses: 13, totalExecutions: 25 }), new Date());
    expect(state).toBe('confirm');
  });
});

describe('assertValidBadgeTransition error paths', () => {
  it('throws InvalidTransitionError for supervised→auto', () => {
    expect(() => assertValidBadgeTransition('supervised', 'auto')).toThrow(InvalidTransitionError);
  });

  it('throws InvalidTransitionError for auto→supervised', () => {
    expect(() => assertValidBadgeTransition('auto', 'supervised')).toThrow(InvalidTransitionError);
  });

  it('throws InvalidTransitionError for regressing→auto', () => {
    expect(() => assertValidBadgeTransition('regressing', 'auto')).toThrow(InvalidTransitionError);
  });

  it('error includes from and to states', () => {
    try {
      assertValidBadgeTransition('supervised', 'confirm');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidTransitionError);
      const err = e as InvalidTransitionError;
      expect(err.from).toBe('supervised');
      expect(err.to).toBe('confirm');
    }
  });

  it('error has correct name property', () => {
    try {
      assertValidBadgeTransition('stick_time', 'supervised');
    } catch (e) {
      expect((e as Error).name).toBe('InvalidTransitionError');
    }
  });

  it('allows all valid transitions without throwing', () => {
    const valid: Array<[string, string]> = [
      ['supervised', 'promoting'],
      ['promoting', 'confirm'],
      ['promoting', 'supervised'],
      ['confirm', 'promoting'],
      ['confirm', 'regressing'],
      ['auto', 'stick_time'],
      ['auto', 'regressing'],
      ['stick_time', 'auto'],
      ['stick_time', 'regressing'],
      ['regressing', 'confirm'],
    ];
    for (const [from, to] of valid) {
      expect(() => assertValidBadgeTransition(from as never, to as never)).not.toThrow();
    }
  });
});
