import { getInvoiceDetailAction } from './actions';
import { SendInvoiceButtons } from './components/send-invoice-button';
import { formatCentsToDollar } from '@flow/shared';
import Link from 'next/link';

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const result = await getInvoiceDetailAction(invoiceId);

  if (!result.success || !result.data) {
    return (
      <div className="space-y-6">
        <Link href="/invoices" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to invoices
        </Link>
        <p className="text-sm text-destructive">{result.error?.message ?? 'Invoice not found.'}</p>
      </div>
    );
  }

  const invoice = result.data;
  const isDraft = invoice.status === 'draft';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/invoices" className="text-sm text-muted-foreground hover:underline">
            &larr; Back
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoiceNumber}</h1>
          <StatusBadge status={invoice.status} />
        </div>
        <div className="flex gap-2">
          {isDraft ? (
            <>
              <Link
                href={`/invoices/${invoiceId}/edit`}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Edit
              </Link>
              <SendInvoiceButtons
                invoiceId={invoiceId}
                invoiceNumber={invoice.invoiceNumber}
                clientName={invoice.clientName}
                clientEmail={invoice.clientEmail}
                status={invoice.status}
                paymentUrl={invoice.paymentUrl}
              />
            </>
          ) : (
            <SendInvoiceButtons
              invoiceId={invoiceId}
              invoiceNumber={invoice.invoiceNumber}
              clientName={invoice.clientName}
              clientEmail={invoice.clientEmail}
              status={invoice.status}
              paymentUrl={invoice.paymentUrl}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border p-4 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Client</h2>
          <p className="font-medium">{invoice.clientName}</p>
          {invoice.clientEmail && (
            <p className="text-sm text-muted-foreground">{invoice.clientEmail}</p>
          )}
        </div>
        <div className="rounded-md border p-4 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Details</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Issue Date</span>
            <span>{invoice.issueDate}</span>
            <span className="text-muted-foreground">Due Date</span>
            <span>{invoice.dueDate}</span>
            <span className="text-muted-foreground">Currency</span>
            <span className="uppercase">{invoice.currency}</span>
            {invoice.sentAt && (
              <>
                <span className="text-muted-foreground">Sent</span>
                <span>{new Date(invoice.sentAt).toLocaleDateString()}</span>
              </>
            )}
            {invoice.viewedAt && (
              <>
                <span className="text-muted-foreground">Viewed</span>
                <span>{new Date(invoice.viewedAt).toLocaleDateString()}</span>
              </>
            )}
            {invoice.deliveries.length > 0 && invoice.deliveries[0]?.status === 'failed' && (
              <>
                <span className="text-muted-foreground">Delivery</span>
                <span className="text-destructive">Failed (retries: {invoice.deliveries[0].retryCount})</span>
              </>
            )}
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="rounded-md border p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Description</th>
              <th className="px-4 py-3 text-right font-medium">Qty</th>
              <th className="px-4 py-3 text-right font-medium">Unit Price</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  {item.description}
                  <span className="ml-2 text-xs text-muted-foreground">({item.sourceType.replaceAll('_', ' ')})</span>
                </td>
                <td className="px-4 py-3 text-right font-mono">{item.quantity}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCentsToDollar(item.unitPriceCents)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCentsToDollar(item.amountCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30">
              <td colSpan={3} className="px-4 py-3 text-right font-medium">Total</td>
              <td className="px-4 py-3 text-right font-mono font-medium">
                {formatCentsToDollar(invoice.totalCents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {invoice.voidedAt && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-medium text-red-800">Voided</h2>
          <p className="text-sm text-red-700">
            This invoice was voided on {new Date(invoice.voidedAt).toLocaleDateString()}.
            {invoice.voidReason && ` Reason: ${invoice.voidReason}`}
          </p>
        </div>
      )}

      <div className="rounded-md border border-dashed p-4">
        <p className="text-sm text-muted-foreground">Attachments (coming soon)</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-indigo-100 text-indigo-700',
    partially_paid: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    voided: 'bg-gray-100 text-gray-400 line-through',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
