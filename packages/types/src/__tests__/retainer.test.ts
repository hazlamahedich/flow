import { describe, it, expect } from 'vitest';
import {
  retainerTypeEnum,
  createRetainerSchema,
  updateRetainerSchema,
  cancelRetainerSchema,
  retainerSchema,
} from '../retainer';

describe('retainerTypeEnum', () => {
  it('accepts valid types', () => {
    expect(retainerTypeEnum.parse('hourly_rate')).toBe('hourly_rate');
    expect(retainerTypeEnum.parse('flat_monthly')).toBe('flat_monthly');
    expect(retainerTypeEnum.parse('package_based')).toBe('package_based');
  });

  it('rejects invalid type', () => {
    expect(() => retainerTypeEnum.parse('invalid')).toThrow();
  });
});

describe('createRetainerSchema', () => {
  describe('hourly_rate', () => {
    it('validates hourly_rate with required fields', () => {
      const result = createRetainerSchema.safeParse({
        type: 'hourly_rate',
        clientId: crypto.randomUUID(),
        hourlyRateCents: 5000,
      });
      expect(result.success).toBe(true);
    });

    it('rejects hourly_rate without rate', () => {
      const result = createRetainerSchema.safeParse({
        type: 'hourly_rate',
        clientId: crypto.randomUUID(),
      });
      expect(result.success).toBe(false);
    });

    it('rejects hourly_rate with zero rate', () => {
      const result = createRetainerSchema.safeParse({
        type: 'hourly_rate',
        clientId: crypto.randomUUID(),
        hourlyRateCents: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects hourly_rate with cross-type fields', () => {
      const result = createRetainerSchema.safeParse({
        type: 'hourly_rate',
        clientId: crypto.randomUUID(),
        hourlyRateCents: 5000,
        monthlyFeeCents: 200000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('flat_monthly', () => {
    it('validates flat_monthly with required fields', () => {
      const result = createRetainerSchema.safeParse({
        type: 'flat_monthly',
        clientId: crypto.randomUUID(),
        monthlyFeeCents: 200000,
        monthlyHoursThreshold: '30.00',
      });
      expect(result.success).toBe(true);
    });

    it('rejects flat_monthly without monthlyHoursThreshold', () => {
      const result = createRetainerSchema.safeParse({
        type: 'flat_monthly',
        clientId: crypto.randomUUID(),
        monthlyFeeCents: 200000,
      });
      expect(result.success).toBe(false);
    });

    it('rejects flat_monthly without fee', () => {
      const result = createRetainerSchema.safeParse({
        type: 'flat_monthly',
        clientId: crypto.randomUUID(),
        monthlyHoursThreshold: '30.00',
      });
      expect(result.success).toBe(false);
    });

    it('rejects flat_monthly with zero hours threshold', () => {
      const result = createRetainerSchema.safeParse({
        type: 'flat_monthly',
        clientId: crypto.randomUUID(),
        monthlyFeeCents: 200000,
        monthlyHoursThreshold: '0',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('package_based', () => {
    it('validates package_based with required fields', () => {
      const result = createRetainerSchema.safeParse({
        type: 'package_based',
        clientId: crypto.randomUUID(),
        packageHours: '40.00',
        packageName: 'Social Media Management',
      });
      expect(result.success).toBe(true);
    });

    it('allows optional hourly_rate_cents for overage', () => {
      const result = createRetainerSchema.safeParse({
        type: 'package_based',
        clientId: crypto.randomUUID(),
        packageHours: '40.00',
        packageName: 'Social Media Management',
        hourlyRateCents: 7500,
      });
      expect(result.success).toBe(true);
    });

    it('rejects package_based without packageHours', () => {
      const result = createRetainerSchema.safeParse({
        type: 'package_based',
        clientId: crypto.randomUUID(),
        packageName: 'Social Media Management',
      });
      expect(result.success).toBe(false);
    });

    it('rejects package_based without packageName', () => {
      const result = createRetainerSchema.safeParse({
        type: 'package_based',
        clientId: crypto.randomUUID(),
        packageHours: '40.00',
      });
      expect(result.success).toBe(false);
    });
  });

  it('rejects invalid type', () => {
    const result = createRetainerSchema.safeParse({
      type: 'invalid',
      clientId: crypto.randomUUID(),
      hourlyRateCents: 5000,
    });
    expect(result.success).toBe(false);
  });

  it('strips extra fields', () => {
    const result = createRetainerSchema.safeParse({
      type: 'hourly_rate',
      clientId: crypto.randomUUID(),
      hourlyRateCents: 5000,
      extraField: 'should be stripped',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('extraField' in result.data).toBe(false);
    }
  });
});

describe('updateRetainerSchema', () => {
  it('accepts partial updates', () => {
    const result = updateRetainerSchema.safeParse({
      retainerId: crypto.randomUUID(),
      notes: 'Updated notes',
    });
    expect(result.success).toBe(true);
  });

  it('does not include type field', () => {
    const schema = updateRetainerSchema;
    const parsed = schema.safeParse({
      retainerId: crypto.randomUUID(),
      type: 'flat_monthly',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect('type' in parsed.data).toBe(false);
    }
  });

  it('requires retainerId', () => {
    const result = updateRetainerSchema.safeParse({
      notes: 'Updated notes',
    });
    expect(result.success).toBe(false);
  });
});

describe('cancelRetainerSchema', () => {
  it('validates with retainerId only', () => {
    const result = cancelRetainerSchema.safeParse({
      retainerId: crypto.randomUUID(),
    });
    expect(result.success).toBe(true);
  });

  it('validates with optional reason', () => {
    const result = cancelRetainerSchema.safeParse({
      retainerId: crypto.randomUUID(),
      reason: 'Client ended contract',
    });
    expect(result.success).toBe(true);
  });

  it('requires retainerId', () => {
    const result = cancelRetainerSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects reason over 500 chars', () => {
    const result = cancelRetainerSchema.safeParse({
      retainerId: crypto.randomUUID(),
      reason: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe('retainerSchema', () => {
  it('validates full retainer object', () => {
    const result = retainerSchema.safeParse({
      id: crypto.randomUUID(),
      workspaceId: crypto.randomUUID(),
      clientId: crypto.randomUUID(),
      type: 'hourly_rate',
      hourlyRateCents: 5000,
      monthlyFeeCents: null,
      monthlyHoursThreshold: null,
      packageHours: null,
      packageName: null,
      billingPeriodDays: 30,
      startDate: '2026-01-01',
      endDate: null,
      status: 'active',
      cancelledAt: null,
      cancellationReason: null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });
});
