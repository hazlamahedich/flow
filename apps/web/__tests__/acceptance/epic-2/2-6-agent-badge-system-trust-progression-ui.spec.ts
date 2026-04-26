import { describe, test, expect } from 'vitest';
import {
  TRUST_BADGE_DISPLAY,
  VALID_BADGE_TRANSITIONS,
  InvalidTransitionError,
  deriveBadgeState,
  assertValidBadgeTransition,
} from '@flow/trust';
import type { TrustBadgeState, TrustMatrixEntry } from '@flow/trust';

function makeEntry(overrides: Partial<TrustMatrixEntry>): TrustMatrixEntry {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    workspaceId: '00000000-0000-0000-0000-000000000002',
    agentId: 'inbox',
    actionType: 'categorize',
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

describe('Story 2.6: Agent Badge System & Trust Progression UI', () => {
  describe('Agent Badge Rendering', () => {
    const badgeStates: TrustBadgeState[] = ['supervised', 'confirm', 'auto', 'promoting', 'regressing', 'stick_time'];

    test('[P0] should define display properties for all badge states', () => {
      for (const state of badgeStates) {
        expect(TRUST_BADGE_DISPLAY[state]).toBeDefined();
        expect(TRUST_BADGE_DISPLAY[state].label).toBeTruthy();
        expect(TRUST_BADGE_DISPLAY[state].colorToken).toBeTruthy();
        expect(TRUST_BADGE_DISPLAY[state].borderStyle).toBeTruthy();
      }
    });

    test('[P0] should render trust level dot: building, established, or auto (UX-DR4)', () => {
      expect(TRUST_BADGE_DISPLAY.supervised.colorToken).toContain('trust-building');
      expect(TRUST_BADGE_DISPLAY.confirm.colorToken).toContain('trust-confirm');
      expect(TRUST_BADGE_DISPLAY.auto.colorToken).toContain('trust-auto');
    });

    test('[P0] should render status ring with different border styles per state (UX-DR4)', () => {
      expect(TRUST_BADGE_DISPLAY.supervised.borderStyle).toBe('1px solid');
      expect(TRUST_BADGE_DISPLAY.confirm.borderStyle).toBe('1px dashed');
      expect(TRUST_BADGE_DISPLAY.auto.borderStyle).toBe('none');
    });
  });

  describe('Trust Progression UI Evolution', () => {
    test('[P0] should show promoting state when supervised meets thresholds (UX-DR5)', () => {
      const entry = makeEntry({ currentLevel: 'supervised', score: 75, consecutiveSuccesses: 8 });
      const state = deriveBadgeState(entry, new Date());
      expect(state).toBe('promoting');
    });

    test('[P0] should show supervised state when thresholds not met (UX-DR5)', () => {
      const entry = makeEntry({ currentLevel: 'supervised', score: 30, consecutiveSuccesses: 2 });
      const state = deriveBadgeState(entry, new Date());
      expect(state).toBe('supervised');
    });

    test('[P0] should show confirm state for established trust (UX-DR5)', () => {
      const entry = makeEntry({ currentLevel: 'confirm', score: 100, consecutiveSuccesses: 5 });
      const state = deriveBadgeState(entry, new Date());
      expect(state).toBe('confirm');
    });

    test('[P0] should show auto state for fully autonomous trust (UX-DR5)', () => {
      const recentTransition = new Date();
      const entry = makeEntry({ currentLevel: 'auto', score: 150, consecutiveSuccesses: 20, lastTransitionAt: recentTransition });
      const state = deriveBadgeState(entry, new Date());
      expect(state).toBe('auto');
    });

    test('[P0] should show stick_time when auto for 30+ days', () => {
      const oldTransition = new Date(Date.now() - 31 * 86_400_000);
      const entry = makeEntry({ currentLevel: 'auto', score: 150, consecutiveSuccesses: 20, lastTransitionAt: oldTransition });
      const state = deriveBadgeState(entry, new Date());
      expect(state).toBe('stick_time');
    });
  });

  describe('Trust Color Transitions', () => {
    test('[P0] should use blue for building, violet for established, green for auto (UX-DR13)', () => {
      expect(TRUST_BADGE_DISPLAY.supervised.colorToken).toMatch(/building/i);
      expect(TRUST_BADGE_DISPLAY.confirm.colorToken).toMatch(/confirm/i);
      expect(TRUST_BADGE_DISPLAY.auto.colorToken).toMatch(/auto/i);
    });

    test('[P1] should define regressing color as betrayed/emotion token (UX-DR13)', () => {
      expect(TRUST_BADGE_DISPLAY.regressing.colorToken).toMatch(/betrayed/i);
    });
  });

  describe('Badge Transition Validation', () => {
    test('[P0] should allow valid badge transitions', () => {
      expect(() => assertValidBadgeTransition('supervised', 'promoting')).not.toThrow();
      expect(() => assertValidBadgeTransition('confirm', 'regressing')).not.toThrow();
      expect(() => assertValidBadgeTransition('auto', 'stick_time')).not.toThrow();
    });

    test('[P0] should reject invalid badge transitions', () => {
      expect(() => assertValidBadgeTransition('supervised', 'auto')).toThrow(InvalidTransitionError);
      expect(() => assertValidBadgeTransition('auto', 'supervised')).toThrow(InvalidTransitionError);
    });

    test('[P1] should define valid transitions from regressing state', () => {
      expect(VALID_BADGE_TRANSITIONS.regressing).toEqual(['confirm']);
    });
  });

  describe('Trust Recovery & Dignified Rollback', () => {
    test('[P0] should use dignified rollback language during trust regression (UX-DR14)', () => {
      expect(TRUST_BADGE_DISPLAY.regressing.label).toMatch(/something changed/i);
    });

    test('[P0] should define regressing→confirm as the recovery path', () => {
      expect(VALID_BADGE_TRANSITIONS.regressing).toContain('confirm');
    });

    test.skip('[P0] should provide one-click undo for trust regression (UX-DR14)', () => {
      // Requires UI component test
    });

    test.skip('[P1] should show accumulated trust data during graceful downgrade (UX-DR45)', () => {
      // Requires UI component test
    });
  });

  describe('Trust Milestone Celebrations & Ceremonies', () => {
    test.skip('[P1] should celebrate trust milestones e.g. "100 tasks, no stumbles" (UX-DR20)', () => {
      // Requires ceremony component
    });

    test.skip('[P1] should animate badge pulse and whisper notification on trust transition (UX-DR17)', () => {
      // Requires animation component test
    });
  });

  describe('Screen Reader Accessibility', () => {
    test('[P0] should provide text labels for all badge display states (UX-DR49)', () => {
      const states = Object.keys(TRUST_BADGE_DISPLAY) as TrustBadgeState[];
      for (const state of states) {
        expect(TRUST_BADGE_DISPLAY[state].label).toBeTruthy();
        expect(typeof TRUST_BADGE_DISPLAY[state].label).toBe('string');
      }
    });

    test.skip('[P0] should announce trust level changes to screen readers (UX-DR49)', () => {
      // Requires component render test with ARIA live region verification
    });

    test.skip('[P1] should provide accessible labels for badge visual elements', () => {
      // Requires component render test
    });
  });
});
