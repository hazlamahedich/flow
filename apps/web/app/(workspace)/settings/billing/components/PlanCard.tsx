'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@flow/types';

interface PlanCardProps {
  checkoutAction: (input: unknown) => Promise<ActionResult<{ url: string }>>;
  currentTier: string;
  planDisplayPrices: Record<'pro' | 'agency', { label: string; interval: string }>;
}

interface PlanOption {
  tier: 'pro' | 'agency';
  label: string;
  description: string;
}

const PLAN_OPTIONS: PlanOption[] = [
  {
    tier: 'pro',
    label: 'Pro',
    description: 'More clients, more agents, more automations.',
  },
  {
    tier: 'agency',
    label: 'Agency',
    description: 'Unlimited everything for growing agencies.',
  },
];

/**
 * Upgrade plan card. Renders the available upgradable tiers and triggers
 * `createCheckoutSessionAction` via a Server Action form. On success the
 * browser is redirected to the Stripe-hosted Checkout URL.
 */
export function PlanCard({ checkoutAction, currentTier, planDisplayPrices }: PlanCardProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium text-[var(--flow-color-text-primary)]">Available plans</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {PLAN_OPTIONS.map((option) => {
          const isCurrent = currentTier === option.tier;
          return (
            <PlanCardItem
              key={option.tier}
              option={option}
              isCurrent={isCurrent}
              checkoutAction={checkoutAction}
              priceLabel={planDisplayPrices[option.tier]?.label ?? ''}
            />
          );
        })}
      </div>
    </section>
  );
}

function PlanCardItem({
  option,
  isCurrent,
  checkoutAction,
  priceLabel,
}: {
  option: PlanOption;
  isCurrent: boolean;
  checkoutAction: (input: unknown) => Promise<ActionResult<{ url: string }>>;
  priceLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    async () => {
      const result = await checkoutAction({ tier: option.tier, interval: 'monthly' });
      if (result.success && typeof window !== 'undefined') {
        window.location.href = result.data.url;
      }
      return result;
    },
    null,
  );

  const errorMessage = state && !state.success ? state.error.message : null;

  return (
    <div className="rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)] p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-medium text-[var(--flow-color-text-primary)]">{option.label}</h3>
        <span className="text-sm text-[var(--flow-color-text-secondary)]">{priceLabel}</span>
      </div>
      <p className="mt-1 text-xs text-[var(--flow-color-text-muted)]">{option.description}</p>
      <form action={formAction} className="mt-3">
        <button
          type="submit"
          disabled={isCurrent || isPending}
          className="inline-flex h-9 items-center justify-center rounded-[var(--flow-radius-md)] bg-[var(--flow-color-primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--flow-color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCurrent ? 'Current plan' : isPending ? 'Redirecting…' : `Upgrade to ${option.label}`}
        </button>
      </form>
      {errorMessage && (
        <p className="mt-2 text-xs text-[var(--flow-status-error)]" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
