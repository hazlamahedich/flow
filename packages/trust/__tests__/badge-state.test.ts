import { describe, it, expect } from 'vitest';
import {
  deriveBadgeState,
  assertValidBadgeTransition,
  VALID_BADGE_TRANSITIONS,
  InvalidTransitionError,
} from '../src/badge-state';
import type { TrustBadgeState } from '../src/badge-state';
import type { TrustMatrixEntry } from '../src/types';

function makeEntry(overrides: Partial<TrustMatrixEntry> = {}): TrustMatrixEntry {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    workspaceId: '00000000-0000-0000-0000-000000000002',
    agentId: 'inbox',
    actionType: 'draft_response',
    currentLevel: 'supervised',
    score: 0,
    totalExecutions: 0,
    successfulExecutions: 0,
    consecutiveSuccesses: 0,
    violationCount: 0,
    lastTransitionAt: new Date(),
    lastViolationAt: null,
    cooldownUntil: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe('deriveBadgeState', () => {
  describe('supervised tier', () => {
    it('returns supervised for new agent (score 0)', () => {
      const state = deriveBadgeState(makeEntry({ currentLevel: 'supervised', score: 0 }), now);
      expect(state).toBe('supervised');
    });

    it('returns supervised below promotion threshold', () => {
      const state = deriveBadgeState(makeEntry({
        currentLevel: 'supervised',
        score: 69,
        consecutiveSuccesses: 7,
      }), now);
      expect(state).toBe('supervised');
    });

    it('returns supervised with insufficient consecutive', () => {
      const state = deriveBadgeState(makeEntry({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 6,
      }), now);
      expect(state).toBe('supervised');
    });

    it('returns promoting when score>=70 and consecutive>=7', () => {
      const state = deriveBadgeState(makeEntry({
        currentLevel: 'supervised',
        score: 70,
        consecutiveSuccesses: 7,
      }), now);
      expect(state).toBe('promoting');
    });

    it('returns promoting with higher scores too', () => {
      const state = deriveBadgeState(makeEntry({
        currentLevel: 'supervised',
        score: 120,
        consecutiveSuccesses: 15,
      }), now);
      expect(state).toBe('promoting');
    });
  });

  describe('confirm tier', () => {
    it('returns confirm at moderate score', () => {
      const state = deriveBadgeState(makeEntry({
        currentLevel: 'confirm',
        score: 80,
        consecutiveSuccesses: 8,
      }), now);
      expect(state).toBe('confirm');
    });

    it('returns promoting when score>=140 and consecutive>=14 and total>=20', () => {
      const state = deriveBadgeState(makeEntry({
        currentLevel: 'confirm',
        score: 140,
        consecutiveSuccesses: 14,
        totalExecutions: 20,
      }), now);
      expect(state).toBe('promoting');
    });

    it('returns confirm with insufficient score for auto', () => {
      const state = deriveBadgeState(makeEntry({
        currentLevel: 'confirm',
        score: 139,
        consecutiveSuccesses: 14,
        totalExecutions: 20,
      }), now);
      expect(state).toBe('confirm');
    });

    it('returns confirm with insufficient consecutive for auto', () => {
      const state = deriveBadgeState(makeEntry({
        currentLevel: 'confirm',
        score: 140,
        consecutiveSuccesses: 13,
        totalExecutions: 20,
      }), now);
      expect(state).toBe('confirm');
    });

    it('returns confirm with insufficient total for auto', () => {
      const state = deriveBadgeState(makeEntry({
        currentLevel: 'confirm',
        score: 140,
        consecutiveSuccesses: 14,
        totalExecutions: 19,
      }), now);
      expect(state).toBe('confirm');
    });
  });

  describe('auto tier', () => {
    it('returns auto when recently promoted', () => {
      const state = deriveBadgeState(makeEntry({
        currentLevel: 'auto',
        score: 150,
        lastTransitionAt: daysAgo(5),
      }), now);
      expect(state).toBe('auto');
    });

    it('returns stick_time after 30 days at auto', () => {
      const state = deriveBadgeState(makeEntry({
        currentLevel: 'auto',
        score: 150,
        lastTransitionAt: daysAgo(30),
      }), now);
      expect(state).toBe('stick_time');
    });

    it('returns stick_time after 45 days', () => {
      const state = deriveBadgeState(makeEntry({
        currentLevel: 'auto',
        score: 150,
        lastTransitionAt: daysAgo(45),
      }), now);
      expect(state).toBe('stick_time');
    });
  });

  describe('rapid transitions', () => {
    it('supervised → promoting → confirm (rapid)', () => {
      const s1 = deriveBadgeState(makeEntry({
        currentLevel: 'supervised', score: 70, consecutiveSuccesses: 7,
      }), now);
      expect(s1).toBe('promoting');

      const s2 = deriveBadgeState(makeEntry({
        currentLevel: 'confirm', score: 80, consecutiveSuccesses: 8,
      }), now);
      expect(s2).toBe('confirm');
    });

    it('confirm → promoting → auto (rapid)', () => {
      const s1 = deriveBadgeState(makeEntry({
        currentLevel: 'confirm', score: 140, consecutiveSuccesses: 14, totalExecutions: 20,
      }), now);
      expect(s1).toBe('promoting');

      const s2 = deriveBadgeState(makeEntry({
        currentLevel: 'auto', score: 150, lastTransitionAt: daysAgo(1),
      }), now);
      expect(s2).toBe('auto');
    });
  });

  describe('transition table completeness', () => {
    const allStates: TrustBadgeState[] = ['supervised', 'confirm', 'auto', 'promoting', 'regressing', 'stick_time'];

    it('every state has an entry in VALID_BADGE_TRANSITIONS', () => {
      for (const state of allStates) {
        expect(VALID_BADGE_TRANSITIONS[state]).toBeDefined();
      }
    });

    it('counts exactly 11 valid transitions', () => {
      let total = 0;
      for (const targets of Object.values(VALID_BADGE_TRANSITIONS)) {
        total += targets.length;
      }
      expect(total).toBe(11);
    });
  });

  describe('assertValidBadgeTransition — valid', () => {
    it('supervised → promoting is valid', () => {
      expect(() => assertValidBadgeTransition('supervised', 'promoting')).not.toThrow();
    });

    it('promoting → confirm is valid', () => {
      expect(() => assertValidBadgeTransition('promoting', 'confirm')).not.toThrow();
    });

    it('promoting → supervised is valid', () => {
      expect(() => assertValidBadgeTransition('promoting', 'supervised')).not.toThrow();
    });

    it('confirm → promoting is valid', () => {
      expect(() => assertValidBadgeTransition('confirm', 'promoting')).not.toThrow();
    });

    it('confirm → regressing is valid', () => {
      expect(() => assertValidBadgeTransition('confirm', 'regressing')).not.toThrow();
    });

    it('auto → stick_time is valid', () => {
      expect(() => assertValidBadgeTransition('auto', 'stick_time')).not.toThrow();
    });

    it('auto → regressing is valid', () => {
      expect(() => assertValidBadgeTransition('auto', 'regressing')).not.toThrow();
    });

    it('stick_time → auto is valid', () => {
      expect(() => assertValidBadgeTransition('stick_time', 'auto')).not.toThrow();
    });

    it('stick_time → regressing is valid', () => {
      expect(() => assertValidBadgeTransition('stick_time', 'regressing')).not.toThrow();
    });

    it('regressing → confirm is valid', () => {
      expect(() => assertValidBadgeTransition('regressing', 'confirm')).not.toThrow();
    });

    it('promoting → auto is valid', () => {
      expect(() => assertValidBadgeTransition('promoting', 'auto')).not.toThrow();
    });
  });

  describe('assertValidBadgeTransition — invalid', () => {
    const invalidTransitions: [TrustBadgeState, TrustBadgeState][] = [
      ['supervised', 'confirm'],
      ['supervised', 'auto'],
      ['supervised', 'regressing'],
      ['supervised', 'stick_time'],
      ['supervised', 'supervised'],
      ['confirm', 'supervised'],
      ['confirm', 'auto'],
      ['confirm', 'confirm'],
      ['confirm', 'stick_time'],
      ['auto', 'supervised'],
      ['auto', 'confirm'],
      ['auto', 'promoting'],
      ['auto', 'auto'],
      ['stick_time', 'supervised'],
      ['stick_time', 'confirm'],
      ['stick_time', 'promoting'],
      ['stick_time', 'stick_time'],
      ['promoting', 'regressing'],
      ['promoting', 'stick_time'],
      ['promoting', 'promoting'],
      ['regressing', 'supervised'],
      ['regressing', 'auto'],
      ['regressing', 'promoting'],
      ['regressing', 'stick_time'],
      ['regressing', 'regressing'],
    ];

    it.each(invalidTransitions)('throws for %s → %s', (from, to) => {
      expect(() => assertValidBadgeTransition(from, to)).toThrow(InvalidTransitionError);
    });
  });
});
