import { describe, it, expect } from 'vitest';
import { wizardRetainerSchema } from '../wizard-types';
import type { WizardStep, WizardState, WizardResult } from '../wizard-types';

describe('wizardRetainerSchema', () => {
  it('parses hourly_rate without clientId', () => {
    const input = {
      type: 'hourly_rate' as const,
      hourlyRateCents: 5000,
    };
    const result = wizardRetainerSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === 'hourly_rate') {
      expect(result.data.hourlyRateCents).toBe(5000);
    }
  });

  it('parses flat_monthly without clientId', () => {
    const input = {
      type: 'flat_monthly' as const,
      monthlyFeeCents: 200000,
      monthlyHoursThreshold: '30.00',
    };
    const result = wizardRetainerSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('parses package_based without clientId', () => {
    const input = {
      type: 'package_based' as const,
      packageHours: '40.00',
      packageName: 'Social Media',
    };
    const result = wizardRetainerSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects input with clientId present but not in schema', () => {
    const input = {
      type: 'hourly_rate' as const,
      hourlyRateCents: 5000,
      clientId: 'some-id',
    };
    const result = wizardRetainerSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect('clientId' in result.data).toBe(false);
    }
  });

  it('rejects unknown type', () => {
    const input = {
      type: 'unknown',
      hourlyRateCents: 5000,
    };
    const result = wizardRetainerSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('defaults billingPeriodDays to 30 for hourly_rate', () => {
    const input = {
      type: 'hourly_rate' as const,
      hourlyRateCents: 5000,
    };
    const result = wizardRetainerSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === 'hourly_rate') {
      expect(result.data.billingPeriodDays).toBe(30);
    }
  });
});

describe('WizardStep type', () => {
  it('accepts valid step values', () => {
    const steps: WizardStep[] = [1, 2, 3, 4];
    expect(steps).toHaveLength(4);
  });
});

describe('WizardState interface', () => {
  it('constructs with expected shape', () => {
    const state: WizardState = {
      step: 1,
      contactData: { name: 'Test Client' },
      billingData: {},
      retainerData: null,
      retainerSkipped: false,
    };
    expect(state.step).toBe(1);
    expect(state.contactData.name).toBe('Test Client');
  });
});

describe('WizardResult interface', () => {
  it('constructs success without warning', () => {
    const result: WizardResult = {
      client: {
        id: 'test-id',
        workspaceId: 'ws-id',
        name: 'Test',
        email: null,
        phone: null,
        companyName: null,
        address: null,
        notes: null,
        billingEmail: null,
        hourlyRateCents: null,
        status: 'active',
        archivedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    expect(result.warning).toBeUndefined();
  });

  it('constructs partial success with warning', () => {
    const result: WizardResult = {
      client: {
        id: 'test-id',
        workspaceId: 'ws-id',
        name: 'Test',
        email: null,
        phone: null,
        companyName: null,
        address: null,
        notes: null,
        billingEmail: null,
        hourlyRateCents: null,
        status: 'active',
        archivedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      warning: {
        code: 'RETAINER_SETUP_FAILED',
        message: 'Retainer data was invalid.',
      },
    };
    expect(result.warning?.code).toBe('RETAINER_SETUP_FAILED');
  });
});
