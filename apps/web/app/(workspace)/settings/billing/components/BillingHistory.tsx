interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  totalCents: number;
  amountPaidCents: number;
  currency: string;
  issueDate: string;
}

interface BillingHistoryProps {
  invoices: InvoiceRow[];
}

/**
 * Read-only billing history list (Server Component — no client interactivity).
 *
 * Renders the most recent Flow OS invoices from the local `invoices` table.
 * Stripe subscription invoice history (the Stripe-side ledger of subscription
 * renewals) is deferred to 9-7 and would live behind the Manage Billing
 * portal link today.
 */
export function BillingHistory({ invoices }: BillingHistoryProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium text-[var(--flow-color-text-primary)]">
        Billing history
      </h2>
      {invoices.length === 0 ? (
        <p className="text-sm text-[var(--flow-color-text-muted)]">
          No invoices yet. Invoices you create for your clients will appear
          here.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--flow-color-border-default)] rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)]">
          {invoices.map((invoice) => (
            <li
              key={invoice.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-[var(--flow-color-text-primary)]">
                  {invoice.invoiceNumber}
                </p>
                <p className="text-xs text-[var(--flow-color-text-muted)]">
                  {new Date(invoice.issueDate).toLocaleDateString()} ·{' '}
                  {invoice.currency.toUpperCase()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[var(--flow-color-text-secondary)]">
                  {formatMoney(invoice.totalCents, invoice.currency)}
                </span>
                <span
                  className={`text-xs font-medium ${statusColor(invoice.status)}`}
                >
                  {invoice.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function statusColor(status: string): string {
  if (status === 'paid') return 'text-green-700';
  if (status === 'overdue') return 'text-red-700';
  if (status === 'voided') return 'text-[var(--flow-color-text-muted)]';
  return 'text-[var(--flow-color-text-secondary)]';
}
