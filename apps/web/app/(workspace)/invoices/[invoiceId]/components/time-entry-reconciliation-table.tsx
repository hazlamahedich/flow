'use client';

import Link from 'next/link';

interface ReconciliationRow {
  timeEntryId: string;
  date: string;
  durationMinutes: number;
  description: string;
  invoicedAmountCents: number;
  invoiceNumber: string;
  invoiceStatus: string;
  invoiceId: string;
}

interface TimeEntryReconciliationTableProps {
  rows: ReconciliationRow[];
  clientId: string;
}

export function TimeEntryReconciliationTable({
  rows,
  clientId,
}: TimeEntryReconciliationTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No invoiced time entries for this client.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Date</th>
            <th className="px-4 py-3 text-left font-medium">Description</th>
            <th className="px-4 py-3 text-right font-medium">Duration</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            <th className="px-4 py-3 text-left font-medium">Invoice</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isVoided = r.invoiceStatus === 'voided';
            const isPaid = r.invoiceStatus === 'paid';
            const durationHours = (r.durationMinutes / 60).toFixed(2);

            return (
              <tr
                key={r.timeEntryId}
                className="border-b last:border-0 hover:bg-muted/30"
              >
                <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                <td
                  className="px-4 py-3 max-w-[200px] truncate"
                  title={r.description}
                >
                  {r.description || '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {durationHours}h
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  ${(r.invoicedAmountCents / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/invoices/${r.invoiceId}`}
                    className="text-primary hover:underline"
                  >
                    {r.invoiceNumber || '—'}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {isVoided && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Ready to re-bill
                    </span>
                  )}
                  {isPaid && (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Finalized
                    </span>
                  )}
                  {!isVoided && !isPaid && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {r.invoiceStatus.replaceAll('_', ' ')}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
