'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@flow/types';

interface ManageBillingButtonProps {
  portalAction: (input?: unknown) => Promise<ActionResult<{ url: string }>>;
  hasCustomerId: boolean;
}

/**
 * "Manage billing" button — opens the Stripe Customer Portal. Disabled when
 * the workspace has no `stripe_customer_id` yet (the action returns
 * NOT_CONFIGURED on the server; we render a friendlier disabled state here).
 */
export function ManageBillingButton({
  portalAction,
  hasCustomerId,
}: ManageBillingButtonProps) {
  const [state, formAction, isPending] = useActionState(async () => {
    const result = await portalAction();
    if (result.success && typeof window !== 'undefined') {
      window.location.href = result.data.url;
    }
    return result;
  }, null);

  const errorMessage = state && !state.success ? state.error.message : null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium text-[var(--flow-color-text-primary)]">
        Billing portal
      </h2>
      <p className="text-sm text-[var(--flow-color-text-secondary)]">
        Update your payment method, view invoice history, or cancel your
        subscription via Stripe&apos;s secure Customer Portal.
      </p>
      <form action={formAction}>
        <button
          type="submit"
          disabled={!hasCustomerId || isPending}
          className="inline-flex h-9 items-center justify-center rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)] bg-transparent px-4 text-sm font-medium text-[var(--flow-color-text-primary)] transition-colors hover:bg-[var(--flow-color-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Opening…' : 'Manage billing'}
        </button>
      </form>
      {errorMessage && (
        <p className="text-xs text-[var(--flow-status-error)]" role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
