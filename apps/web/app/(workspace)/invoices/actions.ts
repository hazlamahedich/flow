'use server';

import { createInvoiceAction as _createInvoiceAction } from '@/lib/actions/invoices/create-invoice';
import { getInvoicesAction as _getInvoicesAction } from '@/lib/actions/invoices/get-invoices';
import { getInvoiceDetailAction as _getInvoiceDetailAction } from '@/lib/actions/invoices/get-invoice-detail';
import { updateInvoiceAction as _updateInvoiceAction } from '@/lib/actions/invoices/update-invoice';
import { checkInvoiceDuplicatesAction as _checkInvoiceDuplicatesAction } from '@/lib/actions/invoices/check-invoice-duplicates';
import { recordPaymentAction as _recordPaymentAction } from '@/lib/actions/invoices/record-payment';

export async function createInvoiceAction(
  input: Parameters<typeof _createInvoiceAction>[0],
) {
  return _createInvoiceAction(input);
}

export async function getInvoicesAction(
  page: Parameters<typeof _getInvoicesAction>[0],
  filter?: Parameters<typeof _getInvoicesAction>[1],
) {
  return _getInvoicesAction(page, filter);
}

export async function getInvoiceDetailAction(
  input: Parameters<typeof _getInvoiceDetailAction>[0],
) {
  return _getInvoiceDetailAction(input);
}

export async function updateInvoiceAction(
  input: Parameters<typeof _updateInvoiceAction>[0],
) {
  return _updateInvoiceAction(input);
}

export async function checkInvoiceDuplicatesAction(
  input: Parameters<typeof _checkInvoiceDuplicatesAction>[0],
) {
  return _checkInvoiceDuplicatesAction(input);
}

export async function recordPaymentAction(
  input: Parameters<typeof _recordPaymentAction>[0],
) {
  return _recordPaymentAction(input);
}
