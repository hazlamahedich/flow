'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, cacheTag, invalidateAfterMutation } from '@flow/db';
import { recordPaymentSchema } from '@flow/types';
import type { ActionResult, InvoicePayment, OverpaymentWarning, InvoiceWithBalance } from '@flow/types';
import {
  checkIdempotencyKey,
  fetchInvoiceForPayment,
  callPaymentRpcWithRetry,
} from './record-payment-helpers';
import type { RecordPaymentResult } from './record-payment-helpers';

export async function recordPaymentAction(
  input: unknown,
): Promise<ActionResult<RecordPaymentResult>> {
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation', {
        issues: parsed.error.issues,
      }),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const { invoiceId, amountCents, paymentDate, paymentMethod, notes, idempotencyKey, confirmOverpayment } = parsed.data;

  const idempotencyResult = await checkIdempotencyKey(supabase, ctx.workspaceId, invoiceId, idempotencyKey);
  if (idempotencyResult) return idempotencyResult;

  const invoice = await fetchInvoiceForPayment(supabase, invoiceId, ctx.workspaceId);
  if ('error' in invoice) return { success: false, error: invoice.error };

  const { status, totalCents, amountPaidCents } = invoice;

  const statusError = rejectInvalidStatus(status);
  if (statusError) return statusError;

  const outstanding = totalCents - amountPaidCents;
  const isOverpayment = amountCents > outstanding;

  if (isOverpayment && !confirmOverpayment) {
    return overpaymentWarning(amountCents - outstanding);
  }

  const rpcResult = await callPaymentRpcWithRetry(supabase, {
    invoiceId, workspaceId: ctx.workspaceId, amountCents, paymentMethod, paymentDate, notes, createdBy: ctx.userId,
    idempotencyKey,
  });

  if ('error' in rpcResult) return { success: false, error: rpcResult.error };

  const { paymentId, newStatus, newAmountPaid, newCreditBalance } = rpcResult;
  const nowIso = new Date().toISOString();

  const paymentRecord: InvoicePayment = {
    id: paymentId, invoiceId, workspaceId: ctx.workspaceId, amountCents, paymentMethod, paymentDate,
    notes: notes ?? null, stripePaymentIntentId: null, createdBy: ctx.userId, createdAt: nowIso, updatedAt: nowIso,
  };

  const response: RecordPaymentResult = {
    payment: paymentRecord,
    invoice: {
      id: invoiceId, workspaceId: ctx.workspaceId, clientId: invoice.clientId, clientName: invoice.clientName,
      invoiceNumber: invoice.invoiceNumber, status: newStatus as InvoiceWithBalance['status'],
      issueDate: invoice.issueDate, dueDate: invoice.dueDate, totalCents,
      amountPaidCents: newAmountPaid, creditBalanceCents: newCreditBalance,
      balanceCents: Math.max(totalCents - newAmountPaid, 0),
      currency: invoice.currency, notes: invoice.notes, voidedAt: invoice.voidedAt, voidReason: invoice.voidReason,
      createdAt: invoice.createdAt, updatedAt: nowIso, paymentUrl: invoice.paymentUrl,
      sentAt: invoice.sentAt, viewedAt: invoice.viewedAt, deliveryToken: invoice.deliveryToken,
      version: invoice.version + 1, payments: [paymentRecord],
    },
  };

  if (isOverpayment) {
    response.warning = { type: 'OVERPAYMENT_CREDIT', excessAmountCents: amountCents - outstanding, creditBalanceCents: newCreditBalance };
  }

  revalidateTag(cacheTag('invoice', ctx.workspaceId));
  invalidateAfterMutation('invoice', 'update', ctx.workspaceId);

  return { success: true, data: response };
}

function rejectInvalidStatus(status: string): ActionResult<RecordPaymentResult> | null {
  const rejections: Record<string, { code: string; msg: string }> = {
    voided: { code: 'INVOICE_VOIDED', msg: 'Cannot record payment on a voided invoice.' },
    paid: { code: 'INVOICE_ALREADY_PAID', msg: 'Invoice is already paid.' },
    draft: { code: 'INVOICE_DRAFT', msg: 'Cannot record payment on a draft invoice.' },
  };
  const r = rejections[status];
  if (r) return { success: false, error: createFlowError(400, r.code as 'INVOICE_VOIDED', r.msg, 'financial') };
  return null;
}

function overpaymentWarning(excess: number): ActionResult<RecordPaymentResult> {
  return {
    success: false,
    error: createFlowError(409, 'VALIDATION_ERROR', 'Payment exceeds outstanding balance.', 'validation', {
      overpayment: { type: 'OVERPAYMENT_CREDIT' as const, excessAmountCents: excess, creditBalanceCents: excess },
    }),
  };
}
