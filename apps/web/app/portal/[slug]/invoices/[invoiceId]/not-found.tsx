import Link from 'next/link';

/**
 * Not-found page for unknown portal invoice IDs.
 *
 * Story 9.2 — AC2.
 */
export default function PortalInvoiceNotFound() {
  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold text-[var(--flow-text-primary)]">
        Invoice not found
      </h1>
      <p className="mt-2 text-sm text-[var(--flow-text-muted)]">
        This invoice may have been removed or is no longer available.
      </p>
      <Link
        href="#"
        className="mt-4 inline-block text-sm underline text-[var(--portal-accent)]"
      >
        Back to invoices
      </Link>
    </div>
  );
}
