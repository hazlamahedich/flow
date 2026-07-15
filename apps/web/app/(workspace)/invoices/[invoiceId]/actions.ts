'use server';

import { getInvoiceDetailAction as _getInvoiceDetailAction } from '@/lib/actions/invoices/get-invoice-detail';
import { sendInvoiceAction as _sendInvoiceAction } from '@/lib/actions/invoices/send-invoice';
import { resendInvoiceAction as _resendInvoiceAction } from '@/lib/actions/invoices/resend-invoice';
import { getDeliveryStatusAction as _getDeliveryStatusAction } from '@/lib/actions/invoices/get-delivery-status';
import { recordPaymentAction as _recordPaymentAction } from '@/lib/actions/invoices/record-payment';
import { voidInvoiceAction as _voidInvoiceAction } from '@/lib/actions/invoices/void-invoice';
import { issueCreditNoteAction as _issueCreditNoteAction } from '@/lib/actions/invoices/issue-credit-note';
import { getPaymentAttemptsAction as _getPaymentAttemptsAction } from '@/lib/actions/invoices/get-payment-attempts';

export async function getInvoiceDetailAction(
  input: Parameters<typeof _getInvoiceDetailAction>[0],
) {
  return _getInvoiceDetailAction(input);
}

export async function sendInvoiceAction(
  input: Parameters<typeof _sendInvoiceAction>[0],
) {
  return _sendInvoiceAction(input);
}

export async function resendInvoiceAction(
  input: Parameters<typeof _resendInvoiceAction>[0],
) {
  return _resendInvoiceAction(input);
}

export async function getDeliveryStatusAction(
  input: Parameters<typeof _getDeliveryStatusAction>[0],
) {
  return _getDeliveryStatusAction(input);
}

export async function recordPaymentAction(
  input: Parameters<typeof _recordPaymentAction>[0],
) {
  return _recordPaymentAction(input);
}

export async function voidInvoiceAction(
  input: Parameters<typeof _voidInvoiceAction>[0],
) {
  return _voidInvoiceAction(input);
}

export async function issueCreditNoteAction(
  input: Parameters<typeof _issueCreditNoteAction>[0],
) {
  return _issueCreditNoteAction(input);
}

export async function getPaymentAttemptsAction(
  input: Parameters<typeof _getPaymentAttemptsAction>[0],
) {
  return _getPaymentAttemptsAction(input);
}
