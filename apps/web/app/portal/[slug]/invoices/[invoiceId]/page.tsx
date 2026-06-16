import Link from 'next/link';
import { validatePortalSlug, getPortalInvoiceDetail } from '@/lib/actions/portal';
import { PayInvoiceButton } from '@/app/portal/components/PayInvoiceButton';
import { ValueReceipt } from '@/app/portal/components/ValueReceipt';
import { formatCents } from '@/lib/money';

/**
 * Portal invoice detail page.
 *
 * Story 9.2 — AC2, AC3, AC7 (FR51, FR52, UX-DR37).
 */
export default async function PortalInvoiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string; invoiceId: string }>;
}) {
  const { slug, invoiceId } = await params;
  const session = await validatePortalSlug(slug);
  if (!session) return null;

  const result = await getPortalInvoiceDetail(session, invoiceId);
  if (!result.success) {
    return (
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <p className="text-sm text-[var(--flow-text-muted)]">Invoice not found.</p>
      </div>
    );
  }

  const inv = result.data;

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">
      <Link
        href={`/portal/${slug}/invoices`}
        className="text-sm text-[var(--flow-text-muted)] hover:text-[var(--flow-text-primary)]"
      >
        &larr; All invoices
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--flow-text-primary)]">
            {inv.invoiceNumber}
          </h1>
          <p className="text-sm capitalize text-[var(--flow-text-muted)]">
            {inv.status.replaceAll('_', ' ')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-medium text-[var(--flow-text-primary)]">
            {formatCents(inv.balanceCents)} {inv.currency.toUpperCase()}
          </p>
          <p className="text-sm text-[var(--flow-text-muted)]">Balance due {inv.dueDate}</p>
        </div>
      </div>

      {inv.balanceCents > 0 && (
        <PayInvoiceButton
          portalCtx={session}
          slug={slug}
          invoiceId={inv.id}
          balanceCents={inv.balanceCents}
          currency={inv.currency}
        />
      )}

      <ValueReceipt taskCount={inv.valueReceipt.taskCount} meetingCount={inv.valueReceipt.meetingCount} />

      <div>
        <h2 className="text-lg font-medium text-[var(--flow-text-primary)] mb-2">Line Items</h2>
        <ul className="space-y-1">
          {inv.lineItems.map((li) => (
            <li key={li.id} className="flex justify-between text-sm">
              <span className="text-[var(--flow-text-secondary)]">{li.description}</span>
              <span className="text-[var(--flow-text-primary)]">
                {formatCents(li.amountCents)} {inv.currency.toUpperCase()}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {inv.payments.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-[var(--flow-text-primary)] mb-2">Payments</h2>
          <ul className="space-y-1">
            {inv.payments.map((p) => (
              <li key={`${p.paymentDate}-${p.amountCents}`} className="flex justify-between text-sm">
                <span className="text-[var(--flow-text-secondary)]">
                  {p.paymentDate} ({p.paymentMethod})
                </span>
                <span className="text-[var(--flow-text-primary)]">
                  {formatCents(p.amountCents)} {inv.currency.toUpperCase()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
