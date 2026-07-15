import { getServerSupabase } from '@/lib/supabase-server';
import { formatCentsToDollar } from '@flow/shared';
import Link from 'next/link';
import { getInvoicesAction } from './actions';
import { InvoiceFilterPills } from './components/invoice-filter-pills';

const statusIcons: Record<string, string> = {
  draft: '',
  sent: '\u{1F4E7}',
  viewed: '\u{1F4E7}\u{1F441}\u{FE0F}',
  partially_paid: '',
  paid: '\u2705',
  overdue: '\u26A0\uFE0F',
  voided: '\u{1F6AB}',
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter = params.filter || 'active';
  const result = await getInvoicesAction(1, filter);

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Unable to load invoices.
        </p>
      </div>
    );
  }

  const { invoices, total } = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <Link
          href="/invoices/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create Invoice
        </Link>
      </div>

      {invoices.length === 0 && filter === 'active' ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No invoices yet. Create your first invoice.
          </p>
          <Link
            href="/invoices/new"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Invoice
          </Link>
        </div>
      ) : (
        <>
          <InvoiceFilterPills activeFilter={filter} />
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Invoice #</th>
                  <th className="px-4 py-3 text-left font-medium">Client</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Issue Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`border-b last:border-0 hover:bg-muted/30 ${inv.status === 'voided' ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{inv.clientName}</td>
                    <td className="px-4 py-3">
                      <span className="mr-1">
                        {statusIcons[inv.status] ?? ''}
                      </span>
                      <ListStatusBadge
                        status={inv.status}
                        creditBalanceCents={inv.creditBalanceCents}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCentsToDollar(inv.totalCents)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCentsToDollar(inv.balanceCents)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {inv.issueDate}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {inv.dueDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {total} invoice{total !== 1 ? 's' : ''} total
          </p>
        </>
      )}
    </div>
  );
}

function ListStatusBadge({
  status,
  creditBalanceCents,
}: {
  status: string;
  creditBalanceCents: number;
}) {
  const label = status.replaceAll('_', ' ');
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
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}
      aria-label={`Status: ${label}`}
    >
      {label}
      {creditBalanceCents > 0 && status !== 'paid' && (
        <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">
          Credit
        </span>
      )}
    </span>
  );
}
