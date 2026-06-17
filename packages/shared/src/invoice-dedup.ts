import { createHash } from 'node:crypto';

export interface InvoiceDedupLineItem {
  sourceType: string;
  timeEntryId?: string | null;
  retainerId?: string | null;
  description: string;
  amountCents: number;
  quantity: string;
}

export interface ComputeInvoiceDedupHashInput {
  workspaceId: string;
  clientId: string;
  lineItems: InvoiceDedupLineItem[];
  issueDate: string;
}

export function computeInvoiceDedupHash(input: ComputeInvoiceDedupHashInput): string {
  const signatures = input.lineItems.map((item) => {
    const sourceId = item.timeEntryId ?? item.retainerId ?? '';
    return [
      item.sourceType,
      sourceId,
      item.description,
      String(item.amountCents),
      item.quantity,
    ].join('|');
  });

  signatures.sort();

  const payload = [
    input.workspaceId,
    input.clientId,
    input.issueDate,
    signatures.join(','),
  ].join('::');

  return createHash('sha256').update(payload).digest('hex');
}
