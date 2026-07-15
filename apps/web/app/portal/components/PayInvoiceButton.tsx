'use client';

import { useActionState } from 'react';
import { payInvoicePortalAction } from '@/lib/actions/portal/pay-invoice';
import { formatCents } from '@/lib/money';
import type { PortalContext } from '@/lib/actions/portal/helpers';

/**
 * Pay-invoice button (Client Component).
 *
 * Uses useActionState to call the payInvoicePortalAction Server Action.
 * On success, redirects to the Stripe Checkout URL.
 *
 * Story 9.2 — AC3 (FR52).
 */
interface PayInvoiceButtonProps {
  portalCtx: PortalContext;
  slug: string;
  invoiceId: string;
  balanceCents: number;
  currency: string;
}

export function PayInvoiceButton({
  portalCtx,
  slug,
  invoiceId,
  balanceCents,
  currency,
}: PayInvoiceButtonProps) {
  const [state, formAction, isPending] = useActionState(async () => {
    const result = await payInvoicePortalAction(portalCtx, { invoiceId, slug });
    if (result.success && result.data.checkoutUrl) {
      window.location.href = result.data.checkoutUrl;
      return { success: true, data: { redirected: true } } as {
        success: true;
        data: { redirected: true };
      };
    }
    return result;
  }, null);

  const errorMsg = state && !state.success ? state.error.message : null;
  const isRedirecting =
    state?.success &&
    (state.data as Record<string, unknown> | undefined)?.redirected === true;

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={isPending || isRedirecting || balanceCents <= 0}
        aria-live="polite"
        className="px-4 py-2 rounded-lg font-medium text-[var(--flow-bg-canvas)] disabled:opacity-50"
        style={{ background: 'var(--portal-accent)' }}
      >
        {isPending || isRedirecting
          ? 'Redirecting to checkout...'
          : `Pay ${formatCents(balanceCents)} ${currency.toUpperCase()}`}
      </button>
      {errorMsg && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {errorMsg}
        </p>
      )}
    </form>
  );
}
