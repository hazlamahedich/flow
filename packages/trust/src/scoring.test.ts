import { describe, it, expect } from 'vitest';
import { calculateScoreChange, applyScoreChange, getRiskWeight } from './scoring';
import type { TrustLevel, AgentId } from './types';

describe('scoring', () => {
  describe('calculateScoreChange', () => {
    it('returns +1 for success at supervised', () => {
      expect(calculateScoreChange('supervised', 'success', 1.0)).toBe(1);
    });

    it('returns +1 for success at confirm', () => {
      expect(calculateScoreChange('confirm', 'success', 1.0)).toBe(1);
    });

    it('returns 0 for success at auto', () => {
      expect(calculateScoreChange('auto', 'success', 1.0)).toBe(0);
    });

    it('returns -10 * riskWeight for violation', () => {
      expect(calculateScoreChange('confirm', 'violation', 1.5)).toBe(-15);
    });

    it('returns -5 for precheck failure', () => {
      expect(calculateScoreChange('supervised', 'precheck_failure', 1.0)).toBe(-5);
    });

    it('returns -20 for post-execution violation', () => {
      expect(calculateScoreChange('auto', 'post_execution_violation', 1.0)).toBe(-20);
    });

    it('applies risk weight to base violation', () => {
      expect(calculateScoreChange('confirm', 'violation', 2.0)).toBe(-20);
    });

    it('precheck failure ignores risk weight', () => {
      expect(calculateScoreChange('supervised', 'precheck_failure', 2.0)).toBe(-5);
    });
  });

  describe('applyScoreChange', () => {
    it('floors at 0', () => {
      expect(applyScoreChange(5, -10)).toBe(0);
    });

    it('ceils at 200', () => {
      expect(applyScoreChange(199, 5)).toBe(200);
    });

    it('applies positive delta', () => {
      expect(applyScoreChange(50, 10)).toBe(60);
    });

    it('applies negative delta', () => {
      expect(applyScoreChange(50, -10)).toBe(40);
    });
  });

  describe('getRiskWeight', () => {
    it('returns 0.5 for read-only actions', () => {
      expect(getRiskWeight('inbox' as AgentId, 'categorize_email')).toBe(0.5);
    });

    it('returns 1.0 for internal actions', () => {
      expect(getRiskWeight('calendar' as AgentId, 'schedule_meeting')).toBe(1.0);
    });

    it('returns 1.5 for client-facing actions', () => {
      expect(getRiskWeight('inbox' as AgentId, 'draft_response')).toBe(1.5);
    });

    it('returns 2.0 for financial client-facing actions', () => {
      expect(getRiskWeight('ar-collection' as AgentId, 'draft_followup_email')).toBe(2.0);
    });

    it('defaults to 1.0 for unknown action type', () => {
      expect(getRiskWeight('inbox' as AgentId, 'unknown_action')).toBe(1.0);
    });
  });
});
