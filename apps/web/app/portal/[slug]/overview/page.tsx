import { validatePortalSessionWithDb } from '@/lib/actions/portal';

/**
 * Portal overview placeholder (Story 9.1a scope).
 *
 * The full client-facing overview (invoice list, report history, balance due,
 * etc.) is Story 9.2. For 9.1a we render a minimal authenticated placeholder
 * so the layout is reachable end-to-end and the portal session is exercised.
 */
export default async function PortalOverviewPage() {
  const session = await validatePortalSessionWithDb();
  if (!session) {
    return null;
  }

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
        Welcome
      </h1>
      <p className="text-sm text-[var(--flow-color-text-secondary)]">
        Your client portal is ready. Invoices, reports, and payment options
        will appear here.
      </p>
    </div>
  );
}
