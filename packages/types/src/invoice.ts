import { z } from 'zod';

export const invoiceStatusEnum = z.enum([
  'draft',
  'sent',
  'viewed',
  'partially_paid',
  'paid',
  'overdue',
  'voided',
]);
export type InvoiceStatus = z.infer<typeof invoiceStatusEnum>;

export const invoiceLineItemSourceEnum = z.enum([
  'time_entry',
  'fixed_service',
  'retainer',
  'credit_note',
]);
export type InvoiceLineItemSource = z.infer<typeof invoiceLineItemSourceEnum>;

export const paymentMethodEnum = z.enum([
  'stripe',
  'manual_check',
  'manual_bank_transfer',
  'manual_cash',
  'manual_other',
]);
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

const validDateSchema = z.string().refine(
  (val) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
    const d = new Date(`${val}T00:00:00Z`);
    return d.toISOString().slice(0, 10) === val;
  },
  { message: 'Invalid date' },
);

const boundedQuantity = z.number()
  .min(0.01, { message: 'Quantity must be > 0' })
  .max(999999, { message: 'Quantity too large' })
  .finite({ message: 'Quantity must be finite' });

const boundedAmountCents = z.number()
  .int({ message: 'amountCents must be an integer' })
  .min(0, { message: 'amountCents must be >= 0' })
  .max(999999999999, { message: 'amountCents too large' });

const timeEntryLineItemSchema = z.object({
  sourceType: z.literal('time_entry'),
  description: z.string().trim().min(1).max(500),
  quantity: boundedQuantity,
  timeEntryId: z.string().uuid({ message: 'timeEntryId required for time_entry' }),
}).strict();

const fixedServiceLineItemSchema = z.object({
  sourceType: z.literal('fixed_service'),
  description: z.string().trim().min(1).max(500),
  quantity: boundedQuantity,
  amountCents: boundedAmountCents,
}).strict();

const retainerLineItemSchema = z.object({
  sourceType: z.literal('retainer'),
  description: z.string().trim().min(1).max(500),
  quantity: boundedQuantity,
  retainerId: z.string().uuid({ message: 'retainerId required for retainer' }),
  amountCents: boundedAmountCents,
}).strict();

const allLineItemSchemas = z.discriminatedUnion('sourceType', [
  timeEntryLineItemSchema,
  fixedServiceLineItemSchema,
  retainerLineItemSchema,
]);

export const invoiceLineItemSchema = z.discriminatedUnion('sourceType', [
  timeEntryLineItemSchema,
  fixedServiceLineItemSchema,
  retainerLineItemSchema,
]);
export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;

export const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  lineItems: z
    .array(allLineItemSchemas)
    .min(1, 'At least one line item is required')
    .max(100, 'Maximum 100 line items'),
  issueDate: validDateSchema,
  dueDate: validDateSchema,
  notes: z.string().max(5000).optional(),
}).refine(
  (data) => data.dueDate >= data.issueDate,
  { message: 'dueDate must be >= issueDate', path: ['dueDate'] },
);
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  clientId: z.string().uuid(),
  invoiceNumber: z.string(),
  status: invoiceStatusEnum,
  issueDate: z.string(),
  dueDate: z.string(),
  totalCents: z.number(),
  currency: z.string(),
  notes: z.string().nullable(),
  voidedAt: z.string().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  paymentUrl: z.string().nullable(),
  sentAt: z.string().nullable(),
  viewedAt: z.string().nullable(),
  deliveryToken: z.string().nullable(),
  amountPaidCents: z.number(),
  creditBalanceCents: z.number(),
  version: z.number(),
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const invoiceLineItemSchemaDb = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  sourceType: invoiceLineItemSourceEnum,
  timeEntryId: z.string().uuid().nullable(),
  retainerId: z.string().uuid().nullable(),
  description: z.string(),
  quantity: z.number(),
  unitPriceCents: z.number(),
  amountCents: z.number(),
  sortOrder: z.number(),
  createdAt: z.string(),
});
export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchemaDb>;

export interface DuplicateWarning {
  invoiceId: string;
  invoiceNumber: string;
  reason: 'soft' | 'hard';
  matchingSourceIds?: string[];
  matchingDescription?: string;
}

export const updateInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  lineItems: z
    .array(allLineItemSchemas)
    .min(1)
    .max(100)
    .optional(),
  issueDate: validDateSchema.optional(),
  dueDate: validDateSchema.optional(),
  notes: z.string().max(5000).optional().nullable(),
}).refine(
  (data) => {
    if (data.dueDate && data.issueDate) return data.dueDate >= data.issueDate;
    return true;
  },
  { message: 'dueDate must be >= issueDate', path: ['dueDate'] },
);
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export const voidInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});
export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>;

export const issueCreditNoteSchema = z.object({
  invoiceId: z.string().uuid(),
  amountCents: z.number().int().min(1).max(999999999999),
  reason: z.string().min(1).max(500),
});
export type IssueCreditNoteInput = z.infer<typeof issueCreditNoteSchema>;

export const creditNoteSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  amountCents: z.number(),
  reason: z.string(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CreditNote = z.infer<typeof creditNoteSchema>;
