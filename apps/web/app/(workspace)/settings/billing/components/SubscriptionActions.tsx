'use client';

import { useActionState, useState } from 'react';
import type { ActionResult } from '@flow/types';

interface SubscriptionActionsProps {
  cancelAction: (input?: unknown) => Promise<ActionResult<{ cancelAtPeriodEnd: true }>>;
  reactivateAction: (input?: unknown) => Promise<ActionResult<{ reactivated: true }>>;
  subscriptionStatus: string;
  cancelAtPeriodEnd: boolean;
}

/**
 * Cancel / Reactivate buttons. Cancel requires a two-step confirmation
 * (AC3) to prevent accidental subscription termination. Reactivate only
 * shows when a cancellation is already scheduled (`cancelAtPeriodEnd=true`).
 */
export function SubscriptionActions({
  cancelAction,
  reactivateAction,
  subscriptionStatus,
  cancelAtPeriodEnd,
}: SubscriptionActionsProps) {
  const hasActiveSubscription = subscriptionStatus !== 'free';

  const [cancelState, cancelFormAction, isCancelPending] = useActionState(async () => {
    const result = await cancelAction();
    return result;
  }, null);
  const [reactivateState, reactivateFormAction, isReactivatePending] = useActionState(async () => {
    const result = await reactivateAction();
    return result;
  }, null);

  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const cancelError = cancelState && !cancelState.success ? cancelState.error.message : null;
  const reactivateError =
    reactivateState && !reactivateState.success ? reactivateState.error.message : null;

  if (!hasActiveSubscription) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium text-[var(--flow-color-text-primary)]">Subscription</h2>

      {cancelAtPeriodEnd ? (
        <div className="space-y-2 rounded-[var(--flow-radius-md)] border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            Your subscription is scheduled to cancel at the end of the current period.
          </p>
          <form action={reactivateFormAction}>
            <button
              type="submit"
              disabled={isReactivatePending}
              className="inline-flex h-9 items-center justify-center rounded-[var(--flow-radius-md)] bg-[var(--flow-color-primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--flow-color-primary-hover)] disabled:opacity-50"
            >
              {isReactivatePending ? 'Reactivating…' : 'Reactivate subscription'}
            </button>
          </form>
          {reactivateError && (
            <p className="text-xs text-[var(--flow-status-error)]" role="alert">
              {reactivateError}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {confirmingCancel ? (
            <div className="space-y-2 rounded-[var(--flow-radius-md)] border border-[var(--flow-status-error)] bg-red-50 p-3">
              <p className="text-sm text-red-800">
                Are you sure? You will keep access until the end of the current period, after which
                your subscription will end.
              </p>
              <div className="flex gap-2">
                <form action={cancelFormAction}>
                  <button
                    type="submit"
                    disabled={isCancelPending}
                    className="inline-flex h-9 items-center justify-center rounded-[var(--flow-radius-md)] bg-[var(--flow-status-error)] px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {isCancelPending ? 'Cancelling…' : 'Yes, cancel at period end'}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  className="inline-flex h-9 items-center justify-center rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)] bg-transparent px-4 text-sm font-medium text-[var(--flow-color-text-primary)] hover:bg-[var(--flow-color-bg-secondary)]"
                >
                  Keep subscription
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              className="inline-flex h-9 items-center justify-center rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)] bg-transparent px-4 text-sm font-medium text-[var(--flow-status-error)] hover:bg-red-50"
            >
              Cancel subscription
            </button>
          )}
          {cancelError && (
            <p className="text-xs text-[var(--flow-status-error)]" role="alert">
              {cancelError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
