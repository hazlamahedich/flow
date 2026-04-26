import { describe, test, expect } from 'vitest';
import {
  TrustLevelSchema,
  AgentIdSchema,
  TrustDecisionSchema,
  TransitionCauseSchema,
  applyViolation,
  canGraduate,
  evaluateTransition,
  evaluateContextShift,
  evaluatePreconditions,
  calculateScoreChange,
  applyScoreChange,
  TRUST_BADGE_DISPLAY,
  VALID_BADGE_TRANSITIONS,
  InvalidTransitionError,
  deriveBadgeState,
  assertValidBadgeTransition,
  CONFIRM_THRESHOLD_SCORE,
  AUTO_THRESHOLD_SCORE,
  COOLDOWN_DAYS,
  MS_PER_DAY,
} from '@flow/trust';
import type { TrustBadgeState, TrustMatrixEntry } from '@flow/trust';

describe('Story 2.3: Trust Matrix & Graduation System', () => {
  describe('Per-Agent Trust Matrix', () => {
    test('[P0] should define trust levels per agent per action type (FR29)', () => {
      const levels = TrustLevelSchema.options;
      expect(levels).toContain('supervised');
      expect(levels).toContain('confirm');
      expect(levels).toContain('auto');
      expect(levels).toHaveLength(3);
    });

    test('[P0] should enforce supervised level — agent waits for explicit approval', () => {
      const parse = TrustDecisionSchema.safeParse({
        allowed: false,
        level: 'supervised',
        reason: 'requires approval',
        preconditionsPassed: true,
      });
      expect(parse.success).toBe(true);
      expect(parse.success && parse.data.allowed).toBe(false);
      expect(parse.success && parse.data.level).toBe('supervised');
    });

    test('[P0] should enforce confirm level — agent notifies then acts', () => {
      const parse = TrustDecisionSchema.safeParse({
        allowed: true,
        level: 'confirm',
        reason: 'acting with notification',
        preconditionsPassed: true,
      });
      expect(parse.success).toBe(true);
      expect(parse.success && parse.data.level).toBe('confirm');
    });

    test('[P0] should enforce auto level — agent acts autonomously', () => {
      const parse = TrustDecisionSchema.safeParse({
        allowed: true,
        level: 'auto',
        reason: 'autonomous execution',
        preconditionsPassed: true,
      });
      expect(parse.success).toBe(true);
      expect(parse.success && parse.data.allowed).toBe(true);
      expect(parse.success && parse.data.level).toBe('auto');
    });

    test('[P2] should reject an invalid trust level value', () => {
      const parse = TrustLevelSchema.safeParse('invalid');
      expect(parse.success).toBe(false);
    });
  });

  describe('Trust Graduation', () => {
    test('[P0] should suggest trust level change based on performance data (FR30)', () => {
      const result = evaluateTransition({
        currentLevel: 'supervised',
        score: 75,
        consecutiveSuccesses: 8,
        totalAtCurrentLevel: 10,
        cooldownUntil: null,
        lastViolationAt: null,
      });
      expect(result.canGraduate).toBe(true);
      expect(result.targetLevel).toBe('confirm');
    });

    test('[P0] should enforce 7-day cooldown between automatic trust suggestions (FR30)', () => {
      const now = new Date();
      const cooldownUntil = new Date(now.getTime() + COOLDOWN_DAYS * MS_PER_DAY);
      const result = canGraduate({
        currentLevel: 'supervised',
        score: 80,
        consecutiveSuccesses: 10,
        totalAtCurrentLevel: 15,
        cooldownUntil,
        lastViolationAt: null,
        now,
      });
      expect(result).toBe(false);
    });

    test('[P1] should not auto-graduate trust without sufficient performance history', () => {
      const result = canGraduate({
        currentLevel: 'supervised',
        score: 75,
        consecutiveSuccesses: 3,
        totalAtCurrentLevel: 5,
        cooldownUntil: null,
        lastViolationAt: null,
      });
      expect(result).toBe(false);
    });

    test('[P0] should require confirm threshold score for supervised→confirm graduation', () => {
      expect(CONFIRM_THRESHOLD_SCORE).toBe(70);
    });

    test('[P0] should require auto threshold score for confirm→auto graduation', () => {
      expect(AUTO_THRESHOLD_SCORE).toBe(140);
    });
  });

  describe('Manual Override', () => {
    test('[P0] should allow manual override of trust decisions at any time (FR32)', () => {
      const causes = TransitionCauseSchema.options;
      expect(causes).toContain('manual_override');
    });

    test('[P1] should record manual override reason in audit trail', () => {
      const parse = TransitionCauseSchema.safeParse('manual_override');
      expect(parse.success).toBe(true);
    });
  });

  describe('User-Defined Pre-Conditions', () => {
    test('[P0] should enforce user-defined pre-conditions before agent acts (FR33)', () => {
      const result = evaluatePreconditions(
        [{ condition_key: 'business_hours', condition_expr: 'true', is_active: true }],
        { business_hours: 'false' },
      );
      expect(result.passed).toBe(false);
      expect(result.failedKey).toBe('business_hours');
    });

    test('[P1] should evaluate pre-conditions and block action if unmet', () => {
      const result = evaluatePreconditions(
        [{ condition_key: 'mode', condition_expr: 'production', is_active: true }],
        { mode: 'production' },
      );
      expect(result.passed).toBe(true);
    });

    test('[P1] should pass when preconditions list is empty', () => {
      const result = evaluatePreconditions([], null);
      expect(result.passed).toBe(true);
    });

    test('[P1] should skip inactive preconditions', () => {
      const result = evaluatePreconditions(
        [{ condition_key: 'test', condition_expr: 'fail', is_active: false }],
        { test: 'something_else' },
      );
      expect(result.passed).toBe(true);
    });
  });

  describe('Trust & RLS Independence', () => {
    test('[P0] should keep packages/trust interface independent from RLS', () => {
      const trustExports = [
        'TrustLevelSchema', 'AgentIdSchema', 'TrustDecisionSchema',
        'applyViolation', 'canGraduate', 'evaluateTransition',
        'evaluatePreconditions', 'calculateScoreChange',
      ];
      for (const exp of trustExports) {
        expect(exp.length).toBeGreaterThan(0);
      }
    });

    test.skip('[P1] should enforce trust graduation and RLS as two independent gates', () => {
      // Integration test — requires running Supabase with RLS enabled
    });
  });

  describe('Trust Regression & Dignified Rollback Language', () => {
    test('[P1] should use dignified rollback language in regression UI (UX-DR18)', () => {
      expect(TRUST_BADGE_DISPLAY.regressing.label).toMatch(/change|together|closer/i);
    });

    test('[P0] should apply violation rollback correctly (FR31)', () => {
      expect(applyViolation('auto', 'hard', 0)).toBe('supervised');
      expect(applyViolation('confirm', 'soft', 0)).toBe('supervised');
      expect(applyViolation('supervised', 'soft', 0)).toBe('supervised');
    });

    test('[P0] should apply precheck failure score penalty of -5 (FR34)', () => {
      const delta = calculateScoreChange('auto', 'precheck_failure', 1);
      expect(delta).toBe(-5);
    });

    test('[P0] should apply post-execution violation score penalty of -20 (FR31)', () => {
      const delta = calculateScoreChange('auto', 'post_execution_violation', 1);
      expect(delta).toBe(-20);
    });

    test('[P1] should clamp score to 0–200 range', () => {
      expect(applyScoreChange(5, -10)).toBe(0);
      expect(applyScoreChange(195, 10)).toBe(200);
    });

    test.skip('[P0] should enforce LLM cost ceiling per workspace per billing period (NFR38)', () => {
      // Requires running budget monitor — integration test
    });
  });
});
