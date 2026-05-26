export type { InvoiceEditGuard } from '../invoices/invoice-edit-guard';
export { createInvoiceEditGuard } from '../invoices/invoice-edit-guard';

export const defaultInvoiceEditGuard: import('../invoices/invoice-edit-guard').InvoiceEditGuard = {
  isInvoiced: async (_entryId: string): Promise<boolean> => false,
};
