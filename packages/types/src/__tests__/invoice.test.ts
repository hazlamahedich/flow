import { describe, it, expect } from 'vitest';
import {
  createInvoiceSchema,
  invoiceStatusEnum,
  invoiceLineItemSchema,
  updateInvoiceSchema,
  voidInvoiceSchema,
  issueCreditNoteSchema,
} from '../invoice';

describe('invoiceStatusEnum', () => {
  it('accepts all valid statuses', () => {
    const statuses = ['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'voided'];
    for (const s of statuses) {
      expect(invoiceStatusEnum.safeParse(s).success).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    expect(invoiceStatusEnum.safeParse('unknown').success).toBe(false);
  });
});

describe('invoiceLineItemSchema', () => {
  it('accepts time_entry with timeEntryId', () => {
    const result = invoiceLineItemSchema.safeParse({
      sourceType: 'time_entry',
      description: 'Development work',
      quantity: 2.5,
      timeEntryId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('accepts fixed_service with amountCents', () => {
    const result = invoiceLineItemSchema.safeParse({
      sourceType: 'fixed_service',
      description: 'Consulting fee',
      quantity: 1,
      amountCents: 50000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts retainer with retainerId and amountCents', () => {
    const result = invoiceLineItemSchema.safeParse({
      sourceType: 'retainer',
      description: 'Monthly retainer',
      quantity: 1,
      retainerId: '00000000-0000-0000-0000-000000000002',
      amountCents: 100000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects time_entry without timeEntryId', () => {
    const result = invoiceLineItemSchema.safeParse({
      sourceType: 'time_entry',
      description: 'Work',
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects fixed_service without amountCents', () => {
    const result = invoiceLineItemSchema.safeParse({
      sourceType: 'fixed_service',
      description: 'Work',
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects retainer without retainerId', () => {
    const result = invoiceLineItemSchema.safeParse({
      sourceType: 'retainer',
      description: 'Retainer',
      quantity: 1,
      amountCents: 50000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects time_entry with amountCents (server computes)', () => {
    const result = invoiceLineItemSchema.safeParse({
      sourceType: 'time_entry',
      description: 'Work',
      quantity: 2,
      timeEntryId: '00000000-0000-0000-0000-000000000001',
      amountCents: 10000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects quantity <= 0', () => {
    const result = invoiceLineItemSchema.safeParse({
      sourceType: 'fixed_service',
      description: 'Work',
      quantity: 0,
      amountCents: 50000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects amountCents < 0', () => {
    const result = invoiceLineItemSchema.safeParse({
      sourceType: 'fixed_service',
      description: 'Work',
      quantity: 1,
      amountCents: -100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty description', () => {
    const result = invoiceLineItemSchema.safeParse({
      sourceType: 'fixed_service',
      description: '  ',
      quantity: 1,
      amountCents: 500,
    });
    expect(result.success).toBe(false);
  });
});

describe('createInvoiceSchema', () => {
  const validBase = {
    clientId: '00000000-0000-0000-0000-000000000099',
    lineItems: [
      {
        sourceType: 'fixed_service',
        description: 'Consulting',
        quantity: 1,
        amountCents: 50000,
      },
    ],
    issueDate: '2026-05-26',
    dueDate: '2026-06-25',
  };

  it('accepts valid invoice input', () => {
    expect(createInvoiceSchema.safeParse(validBase).success).toBe(true);
  });

  it('rejects missing clientId', () => {
    const { clientId: _, ...noId } = validBase;
    expect(createInvoiceSchema.safeParse(noId).success).toBe(false);
  });

  it('rejects empty lineItems', () => {
    expect(createInvoiceSchema.safeParse({ ...validBase, lineItems: [] }).success).toBe(false);
  });

  it('rejects more than 100 lineItems', () => {
    const items = Array.from({ length: 101 }, (_, i) => ({
      sourceType: 'fixed_service' as const,
      description: `Item ${i}`,
      quantity: 1,
      amountCents: 1000,
    }));
    expect(createInvoiceSchema.safeParse({ ...validBase, lineItems: items }).success).toBe(false);
  });

  it('rejects 100 lineItems (boundary)', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      sourceType: 'fixed_service' as const,
      description: `Item ${i}`,
      quantity: 1,
      amountCents: 1000,
    }));
    expect(createInvoiceSchema.safeParse({ ...validBase, lineItems: items }).success).toBe(true);
  });

  it('rejects dueDate before issueDate', () => {
    expect(
      createInvoiceSchema.safeParse({ ...validBase, issueDate: '2026-06-01', dueDate: '2026-05-01' }).success,
    ).toBe(false);
  });

  it('accepts dueDate equal to issueDate', () => {
    expect(
      createInvoiceSchema.safeParse({ ...validBase, issueDate: '2026-05-26', dueDate: '2026-05-26' }).success,
    ).toBe(true);
  });

  it('accepts optional notes', () => {
    expect(createInvoiceSchema.safeParse({ ...validBase, notes: 'Net 30' }).success).toBe(true);
  });

  it('accepts time_entry line items without amountCents', () => {
    // NOTE: time_entry line items are now allowed in Zod schema (unblocked in Story 7-3)
    // but rejected by Server Action with NOT_IMPLEMENTED. See Story 7-3a.
    const input = {
      ...validBase,
      lineItems: [
        {
          sourceType: 'time_entry',
          description: 'Dev work',
          quantity: 3.5,
          timeEntryId: '00000000-0000-0000-0000-000000000001',
        },
      ],
    };
    expect(createInvoiceSchema.safeParse(input).success).toBe(true);
  });

  it('rejects invalid date format', () => {
    expect(
      createInvoiceSchema.safeParse({ ...validBase, issueDate: '26-05-2026' }).success,
    ).toBe(false);
  });
});

describe('updateInvoiceSchema', () => {
  it('accepts invoiceId only', () => {
    expect(updateInvoiceSchema.safeParse({ invoiceId: '00000000-0000-0000-0000-000000000099' }).success).toBe(true);
  });

  it('accepts notes null', () => {
    expect(
      updateInvoiceSchema.safeParse({
        invoiceId: '00000000-0000-0000-0000-000000000099',
        notes: null,
      }).success,
    ).toBe(true);
  });

  it('rejects dueDate before issueDate when both provided', () => {
    expect(
      updateInvoiceSchema.safeParse({
        invoiceId: '00000000-0000-0000-0000-000000000099',
        issueDate: '2026-06-01',
        dueDate: '2026-05-01',
      }).success,
    ).toBe(false);
  });
});

describe('voidInvoiceSchema', () => {
  it('rejects invoiceId without reason', () => {
    expect(voidInvoiceSchema.safeParse({ invoiceId: '00000000-0000-0000-0000-000000000099' }).success).toBe(false);
  });

  it('accepts invoiceId with reason', () => {
    expect(
      voidInvoiceSchema.safeParse({
        invoiceId: '00000000-0000-0000-0000-000000000099',
        reason: 'Client requested cancellation',
      }).success,
    ).toBe(true);
  });

  it('rejects reason longer than 500 chars', () => {
    expect(
      voidInvoiceSchema.safeParse({
        invoiceId: '00000000-0000-0000-0000-000000000099',
        reason: 'a'.repeat(501),
      }).success,
    ).toBe(false);
  });
});

describe('issueCreditNoteSchema', () => {
  it('accepts valid credit note', () => {
    expect(
      issueCreditNoteSchema.safeParse({
        invoiceId: '00000000-0000-0000-0000-000000000099',
        amountCents: 5000,
        reason: 'Overcharge correction',
      }).success,
    ).toBe(true);
  });

  it('rejects zero amount', () => {
    expect(
      issueCreditNoteSchema.safeParse({
        invoiceId: '00000000-0000-0000-0000-000000000099',
        amountCents: 0,
        reason: 'Zero credit',
      }).success,
    ).toBe(false);
  });

  it('rejects negative amount', () => {
    expect(
      issueCreditNoteSchema.safeParse({
        invoiceId: '00000000-0000-0000-0000-000000000099',
        amountCents: -100,
        reason: 'Negative',
      }).success,
    ).toBe(false);
  });

  it('rejects missing reason', () => {
    expect(
      issueCreditNoteSchema.safeParse({
        invoiceId: '00000000-0000-0000-0000-000000000099',
        amountCents: 1000,
      }).success,
    ).toBe(false);
  });

  it('rejects reason longer than 500 chars', () => {
    expect(
      issueCreditNoteSchema.safeParse({
        invoiceId: '00000000-0000-0000-0000-000000000099',
        amountCents: 1000,
        reason: 'a'.repeat(501),
      }).success,
    ).toBe(false);
  });
});
