import { describe, it, expect } from 'vitest';
import {
  recordPaymentSchema,
  overpaymentWarningSchema,
  invoicePaymentSchema,
} from '../invoice-payment';

describe('recordPaymentSchema', () => {
  const validBase = {
    invoiceId: 'a0000000-0000-0000-0000-000000000001',
    amountCents: 5000,
    paymentDate: '2026-05-26',
    paymentMethod: 'manual_check',
  };

  it('accepts valid payment input', () => {
    expect(recordPaymentSchema.safeParse(validBase).success).toBe(true);
  });

  it('rejects future payment date', () => {
    const result = recordPaymentSchema.safeParse({
      ...validBase,
      paymentDate: '2099-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects amountCents <= 0', () => {
    expect(recordPaymentSchema.safeParse({ ...validBase, amountCents: 0 }).success).toBe(false);
    expect(recordPaymentSchema.safeParse({ ...validBase, amountCents: -1 }).success).toBe(false);
  });

  it('rejects amountCents > 999999999999', () => {
    expect(recordPaymentSchema.safeParse({ ...validBase, amountCents: 1e12 }).success).toBe(false);
  });

  it('rejects invalid paymentMethod', () => {
    expect(recordPaymentSchema.safeParse({ ...validBase, paymentMethod: 'bitcoin' }).success).toBe(false);
  });

  it('accepts optional notes and idempotencyKey', () => {
    const result = recordPaymentSchema.safeParse({
      ...validBase,
      notes: 'Thanks!',
      idempotencyKey: 'key-123',
      confirmOverpayment: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects notes > 1000 chars', () => {
    expect(recordPaymentSchema.safeParse({ ...validBase, notes: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('rejects invalid invoiceId format', () => {
    expect(recordPaymentSchema.safeParse({ ...validBase, invoiceId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('overpaymentWarningSchema', () => {
  it('accepts valid overpayment warning', () => {
    expect(overpaymentWarningSchema.safeParse({
      type: 'OVERPAYMENT_CREDIT',
      excessAmountCents: 500,
      creditBalanceCents: 500,
    }).success).toBe(true);
  });

  it('rejects wrong type', () => {
    expect(overpaymentWarningSchema.safeParse({
      type: 'OTHER',
      excessAmountCents: 500,
      creditBalanceCents: 500,
    }).success).toBe(false);
  });
});

describe('invoicePaymentSchema', () => {
  it('accepts valid payment record', () => {
    expect(invoicePaymentSchema.safeParse({
      id: 'b0000000-0000-0000-0000-000000000001',
      invoiceId: 'a0000000-0000-0000-0000-000000000001',
      workspaceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      amountCents: 5000,
      paymentMethod: 'manual_check',
      paymentDate: '2026-05-26',
      notes: null,
      stripePaymentIntentId: null,
      createdBy: '11111111-1111-1111-1111-111111111111',
      createdAt: '2026-05-26T00:00:00Z',
      updatedAt: '2026-05-26T00:00:00Z',
    }).success).toBe(true);
  });
});
