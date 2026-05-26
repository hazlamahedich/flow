import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getInvoiceDetailAction } from './actions';
import { SendInvoiceButtons } from './components/send-invoice-button';
import { SummaryCard, StatusBadge } from './components/invoice-helpers';
import { formatCentsToDollar } from '@flow/shared';

const RecordPaymentButton = dynamic(
  () => import('./components/record-payment-button').then((m) => m.RecordPaymentButton),
  { ssr: false },
);

async function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const result = await getInvoiceDetailAction(invoiceId);

  if (!result.success) {
    return (
      <div className="space-y-6">
        <Link href="/invoices" className="text-sm text-muted-foreground hover:underline">
          ← Back to invoices
        </Link>
        <p className="text-sm text-destructive">{result.error.message}</p>
      </div>
    );
  }

  if (!result.data) {
    return (
      <div className="space-y-6">
        <Link href="/invoices" className="text-sm text-muted-foreground hover:underline">
          ← Back to invoices
        </Link>
        <p className="text-sm text-destructive">Invoice not found.</p>
      </div>
    );
  }

  const invoice = result.data;
  const isDraft = invoice.status === 'draft';
  const canRecordPayment = !isDraft && !invoice.voidedAt;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/invoices" className="text-sm text-muted-foreground hover:underline">← Back</Link>
          <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoiceNumber}</h1>
          <StatusBadge status={invoice.status} />
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <>
              <Link href={`/invoices/${invoiceId}/edit`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                Edit
              </Link>
              <SendInvoiceButtons
                invoiceId={invoiceId} invoiceNumber={invoice.invoiceNumber}
                clientName={invoice.clientName} clientEmail={invoice.clientEmail}
                status={invoice.status} paymentUrl={invoice.paymentUrl}
              />
            </>
          )}
          {canRecordPayment && (
            <RecordPaymentButton
              invoiceId={invoiceId} invoiceNumber={invoice.invoiceNumber}
              totalCents={invoice.totalCents} amountPaidCents={invoice.amountPaidCents}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Total" value={formatCentsToDollar(invoice.totalCents)} />
        <SummaryCard label="Amount Paid" value={formatCentsToDollar(invoice.amountPaidCents)} />
        <SummaryCard label="Balance" value={formatCentsToDollar(invoice.balanceCents)} />
        {invoice.creditBalanceCents > 0 && (
          <SummaryCard label="Client Credit" value={formatCentsToDollar(invoice.creditBalanceCents)} />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border p-4 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Client</h2>
          <p className="font-medium">{invoice.clientName}</p>
          {invoice.clientEmail && <p className="text-sm text-muted-foreground">{invoice.clientEmail}</p>}
        </div>
        <div className="rounded-md border p-4 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Details</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Issue Date</span><span>{invoice.issueDate}</span>
            <span className="text-muted-foreground">Due Date</span><span>{invoice.dueDate}</span>
            <span className="text-muted-foreground">Currency</span><span className="uppercase">{invoice.currency}</span>
            {invoice.sentAt && (<><span className="text-muted-foreground">Sent</span><span>{new Date(invoice.sentAt).toLocaleDateString()}</span></>)}
            {invoice.viewedAt && (<><span className="text-muted-foreground">Viewed</span><span>{new Date(invoice.viewedAt).toLocaleDateString()}</span></>)}
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
              <td className="px-4 py-3 text-right font-mono font-medium">{formatCentsToDollar(invoice.totalCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="rounded-md border">
        <div className="border-b bg-muted/50 px-4 py-3">
          <h2 className="text-sm font-medium">Payment History</h2>
        </div>
        {invoice.payments.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">No payments recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 text-left font-medium">Method</th>
                <th className="px-4 py-2 text-left font-medium">Recorded By</th>
                <th className="px-4 py-2 text-left font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{p.paymentDate}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatCentsToDollar(p.amountCents)}</td>
                  <td className="px-4 py-2">{p.paymentMethod.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-2">{p.recordedByName ?? '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{p.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
    </div>
  );
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
          <div className="grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
          <div className="h-40 animate-pulse rounded-md bg-muted" />
        </div>
      }
    >
      <InvoiceDetailLoader params={params} />
    </Suspense>
  );
}

async function InvoiceDetailLoader({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  return <InvoiceDetail invoiceId={invoiceId} />;
}
