import { validatePortalSlug, getPortalInvoices } from '@/lib/actions/portal';
import { formatCents } from '@/lib/money';

/**
 * Portal invoice list page.
 *
 * Story 9.2 — AC2 (FR51). Server Component — reads invoices via
 * createPortalClient (RLS-gated, read-only).
 */
export default async function PortalInvoicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await validatePortalSlug(slug);
  if (!session) return null;

  const result = await getPortalInvoices(session);
  if (!result.success) {
    return (
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <p className="text-sm text-[var(--flow-text-muted)]">
          Unable to load invoices at this time.
        </p>
      </div>
    );
  }

  const { invoices } = result.data;

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--flow-text-primary)]">
        Invoices
      </h1>
      {invoices.length === 0 ? (
        <p className="text-sm text-[var(--flow-text-muted)]">
          No invoices yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <a
                href={`/portal/${slug}/invoices/${inv.id}`}
                className="block p-4 rounded-lg border border-[var(--flow-border-default)] hover:border-[var(--portal-accent)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--flow-text-primary)]">
                    {inv.invoiceNumber}
                  </span>
                  <span className="text-sm capitalize text-[var(--flow-text-muted)]">
                    {inv.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm text-[var(--flow-text-secondary)]">
                  <span>
                    {formatCents(inv.balanceCents)} {inv.currency.toUpperCase()}
                  </span>
                  <span>Due {inv.dueDate}</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
