export interface InvoiceEditGuard {
  isInvoiced(entryId: string): Promise<boolean>;
}

export const defaultInvoiceEditGuard: InvoiceEditGuard = {
  isInvoiced: async (_entryId: string): Promise<boolean> => false,
};
