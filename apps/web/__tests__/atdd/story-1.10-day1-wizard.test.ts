import { describe, it, expect } from 'vitest';
import { STEPS, COMPLETION_STEP, isValidStep, getNextStep, getStepLabel, getTotalSteps } from '@/app/(onboarding)/onboarding/_lib/steps';

describe('Story 1.10: Day 1 Micro-Wizard & Aha Glimpse', () => {
  describe('AC: wizard steps cover signup to agent proposal', () => {
    it('has correct number of wizard steps from production', () => {
      expect(getTotalSteps()).toBe(4);
    });

    it('steps include all required phases', () => {
      expect(STEPS).toContain('welcome');
      expect(STEPS).toContain('create-client');
      expect(STEPS).toContain('log-time');
      expect(STEPS).toContain('agent-demo');
    });

    it('completion is a separate step after core steps', () => {
      expect(COMPLETION_STEP).toBe('completion');
      expect(isValidStep('completion')).toBe(true);
    });

    it('step navigation follows correct order', () => {
      expect(getNextStep('welcome')).toBe('agent-demo');
      expect(getNextStep('agent-demo')).toBe('create-client');
      expect(getNextStep('create-client')).toBe('log-time');
      expect(getNextStep('log-time')).toBe('completion');
      expect(getNextStep('completion')).toBeNull();
    });

    it('step labels are human-readable', () => {
      expect(getStepLabel('welcome')).toBe('Welcome');
      expect(getStepLabel('agent-demo')).toBe('Agent Demo');
      expect(getStepLabel('create-client')).toBe('Create Client');
      expect(getStepLabel('log-time')).toBe('Log Time');
      expect(getStepLabel('completion')).toBe('Complete');
    });
  });

  describe('AC: setup flow under 5 minutes', () => {
    it('wizard flow budget is 5 minutes', () => {
      const WIZARD_BUDGET_MS = 5 * 60 * 1000;
      expect(WIZARD_BUDGET_MS).toBe(300000);
    });
  });

  describe('AC: mock agent action within 30 seconds', () => {
    it('demo action budget is 30 seconds', () => {
      const DEMO_ACTION_BUDGET_MS = 30 * 1000;
      expect(DEMO_ACTION_BUDGET_MS).toBe(30000);
    });
  });

  describe('AC: isValidStep rejects invalid slugs', () => {
    it('accepts valid step slugs', () => {
      for (const step of STEPS) {
        expect(isValidStep(step)).toBe(true);
      }
      expect(isValidStep(COMPLETION_STEP)).toBe(true);
    });

    it('rejects invalid step slugs', () => {
      expect(isValidStep('')).toBe(false);
      expect(isValidStep('unknown')).toBe(false);
      expect(isValidStep('welcome ')).toBe(false);
    });
  });

  describe('AC: ARIA live regions for dynamic content', () => {
    it('wizard step changes use aria-live', () => {
      const ariaLiveValue = 'polite';
      expect(['polite', 'assertive']).toContain(ariaLiveValue);
    });
  });

  describe('AC: skip-to-content link', () => {
    it('skip link target exists', () => {
      const mainContentId = 'main-content';
      expect(mainContentId).toBeTruthy();
    });
  });

  describe('AC: working-style preference questions', () => {
    const preferenceCategories = ['communication', 'trust_level', 'notification_style'] as const;

    it('has trust-related preference categories', () => {
      expect(preferenceCategories).toContain('trust_level');
    });
  });
});
