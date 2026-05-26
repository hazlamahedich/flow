import { z } from 'zod';
import { paymentMethodEnum } from './invoice';
import type { Invoice, PaymentMethod } from './invoice';

const validDateSchema = z.string().refine(
  (val) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
    const d = new Date(`${val}T00:00:00Z`);
    return d.toISOString().slice(0, 10) === val;
  },
  { message: 'Invalid date' },
);

export const invoiceDeliveryStatusEnum = z.enum([
  'pending',
  'sent',
  'failed',
  'bounced',
]);
export type InvoiceDeliveryStatus = z.infer<typeof invoiceDeliveryStatusEnum>;

export interface InvoiceDelivery {
  id: string;
  invoiceId: string;
  workspaceId: string;
  status: InvoiceDeliveryStatus;
  sentAt: string | null;
  retryCount: number;
  lastError: string | null;
  messageId: string | null;
  attemptLog: Array<{
    attemptedAt: string;
    error?: string;
    providerResponse?: Record<string, unknown>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amountCents: z.number().int().min(1).max(999999999999),
  paymentDate: validDateSchema.refine(
    (val) => {
      const d = new Date(`${val}T00:00:00Z`);
      const now = new Date();
      const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      return d.getTime() <= todayUtc;
    },
    { message: 'Payment date cannot be in the future' },
  ),
  paymentMethod: paymentMethodEnum,
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().max(255).optional(),
  confirmOverpayment: z.boolean().optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const overpaymentWarningSchema = z.object({
  type: z.literal('OVERPAYMENT_CREDIT'),
  excessAmountCents: z.number(),
  creditBalanceCents: z.number(),
});
export type OverpaymentWarning = z.infer<typeof overpaymentWarningSchema>;

export const invoicePaymentSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  amountCents: z.number(),
  paymentMethod: paymentMethodEnum,
  paymentDate: z.string(),
  notes: z.string().nullable(),
  stripePaymentIntentId: z.string().nullable(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type InvoicePayment = z.infer<typeof invoicePaymentSchema>;

export interface InvoiceWithBalance extends Invoice {
  amountPaidCents: number;
  creditBalanceCents: number;
  balanceCents: number;
  version: number;
  payments: InvoicePayment[];
  clientName?: string;
}

export interface InvoicePaymentHistory {
  id: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  notes: string | null;
  createdAt: string;
  recordedByName: string | null;
}

export interface InvoicePaymentResult {
  payment: InvoicePayment;
  invoice: InvoiceWithBalance;
  warning?: OverpaymentWarning;
}

export const sendInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
});
export type SendInvoiceInput = z.infer<typeof sendInvoiceSchema>;

export const resendInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
});
export type ResendInvoiceInput = z.infer<typeof resendInvoiceSchema>;

export const getDeliveryStatusSchema = z.object({
  invoiceId: z.string().uuid(),
});
export type GetDeliveryStatusInput = z.infer<typeof getDeliveryStatusSchema>;
