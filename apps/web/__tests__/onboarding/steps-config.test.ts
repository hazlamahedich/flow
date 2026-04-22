import { describe, it, expect } from 'vitest';
import {
  STEPS,
  COMPLETION_STEP,
  isValidStep,
  getStepIndex,
  getNextStep,
  getPreviousStep,
  getStepLabel,
  getTotalSteps,
} from '../../app/(onboarding)/onboarding/_lib/steps';

describe('STEPS config', () => {
  it('has exactly 4 steps', () => {
    expect(STEPS).toHaveLength(4);
  });

  it('has steps in correct order', () => {
    expect(STEPS).toEqual([
      'welcome',
      'agent-demo',
      'create-client',
      'log-time',
    ]);
  });

  it('completion step is defined separately', () => {
    expect(COMPLETION_STEP).toBe('completion');
  });
});

describe('isValidStep', () => {
  it('accepts valid step slugs', () => {
    expect(isValidStep('welcome')).toBe(true);
    expect(isValidStep('agent-demo')).toBe(true);
    expect(isValidStep('create-client')).toBe(true);
    expect(isValidStep('log-time')).toBe(true);
    expect(isValidStep('completion')).toBe(true);
  });

  it('rejects invalid step slugs', () => {
    expect(isValidStep('invalid')).toBe(false);
    expect(isValidStep('')).toBe(false);
    expect(isValidStep('Welcome')).toBe(false);
    expect(isValidStep('settings')).toBe(false);
  });
});

describe('getStepIndex', () => {
  it('returns correct index for each step', () => {
    expect(getStepIndex('welcome')).toBe(0);
    expect(getStepIndex('agent-demo')).toBe(1);
    expect(getStepIndex('create-client')).toBe(2);
    expect(getStepIndex('log-time')).toBe(3);
  });
});

describe('getNextStep', () => {
  it('returns next step for all but last', () => {
    expect(getNextStep('welcome')).toBe('agent-demo');
    expect(getNextStep('agent-demo')).toBe('create-client');
    expect(getNextStep('create-client')).toBe('log-time');
  });

  it('returns completion step for last wizard step', () => {
    expect(getNextStep('log-time')).toBe('completion');
  });

  it('returns null for completion step', () => {
    expect(getNextStep('completion')).toBeNull();
  });
});

describe('getPreviousStep', () => {
  it('returns previous step for all but first', () => {
    expect(getPreviousStep('agent-demo')).toBe('welcome');
    expect(getPreviousStep('create-client')).toBe('agent-demo');
    expect(getPreviousStep('log-time')).toBe('create-client');
  });

  it('returns null for first step', () => {
    expect(getPreviousStep('welcome')).toBeNull();
  });

  it('returns log-time for completion step', () => {
    expect(getPreviousStep('completion')).toBe('log-time');
  });
});

describe('getStepLabel', () => {
  it('returns label for each step', () => {
    expect(getStepLabel('welcome')).toBe('Welcome');
    expect(getStepLabel('agent-demo')).toBe('Agent Demo');
    expect(getStepLabel('create-client')).toBe('Create Client');
    expect(getStepLabel('log-time')).toBe('Log Time');
    expect(getStepLabel('completion')).toBe('Complete');
  });
});

describe('getTotalSteps', () => {
  it('returns 4', () => {
    expect(getTotalSteps()).toBe(4);
  });
});
