'use server';

import { createInvoiceAction as _createInvoiceAction } from '@/lib/actions/invoices/create-invoice';
import { checkInvoiceDuplicatesAction as _checkInvoiceDuplicatesAction } from '@/lib/actions/invoices/check-invoice-duplicates';

export async function createInvoiceAction(
  input: Parameters<typeof _createInvoiceAction>[0],
) {
  return _createInvoiceAction(input);
}

export async function checkInvoiceDuplicatesAction(
  input: Parameters<typeof _checkInvoiceDuplicatesAction>[0],
) {
  return _checkInvoiceDuplicatesAction(input);
}
