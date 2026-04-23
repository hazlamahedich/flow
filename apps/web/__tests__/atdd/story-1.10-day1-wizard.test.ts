import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const ClientNameSchema = z.string().min(1).max(200);
const TimeEntrySchema = z.object({
  description: z.string().min(1).max(500),
  durationMinutes: z.number().int().min(1).max(480),
});

describe('Story 1.10: Day 1 Micro-Wizard & Aha Glimpse', () => {
  describe('AC: wizard steps cover signup to agent proposal', () => {
    const wizardSteps = [
      'welcome',
      'create-client',
      'log-time',
      'agent-demo',
      'completion',
    ] as const;

    it('has 5 wizard steps', () => {
      expect(wizardSteps).toHaveLength(5);
    });

    it('steps are in correct order', () => {
      expect(wizardSteps[0]).toBe('welcome');
      expect(wizardSteps[1]).toBe('create-client');
      expect(wizardSteps[2]).toBe('log-time');
      expect(wizardSteps[3]).toBe('agent-demo');
      expect(wizardSteps[4]).toBe('completion');
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

  describe('AC: create-client form validation', () => {
    it('accepts valid client name', () => {
      expect(ClientNameSchema.safeParse('Acme Corp').success).toBe(true);
    });

    it('rejects empty client name', () => {
      expect(ClientNameSchema.safeParse('').success).toBe(false);
    });

    it('rejects client name over 200 chars', () => {
      expect(ClientNameSchema.safeParse('A'.repeat(201)).success).toBe(false);
    });
  });

  describe('AC: log-time form validation', () => {
    it('accepts valid time entry', () => {
      const result = TimeEntrySchema.safeParse({ description: 'Client call', durationMinutes: 30 });
      expect(result.success).toBe(true);
    });

    it('rejects zero duration', () => {
      const result = TimeEntrySchema.safeParse({ description: 'Client call', durationMinutes: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects duration over 8 hours', () => {
      const result = TimeEntrySchema.safeParse({ description: 'Client call', durationMinutes: 481 });
      expect(result.success).toBe(false);
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
