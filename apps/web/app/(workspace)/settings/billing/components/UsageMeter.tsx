'use client';

/**
 * UsageMeter — usage-vs-limits display (Story 9.4 AC6 — FR55, FR56).
 *
 * Client component. Renders one UsageMeterItem per resource (clients / team
 * / agents) plus an "Upgrade" link that calls `changeTierAction` (AC4) for
 * the one-click upgrade path (FR56: "one-click upgrade path"). Agency tier
 * shows "Unlimited" for every meter.
 */
import { useActionState } from 'react';
import type { ActionResult, SubscriptionTier } from '@flow/types';
import { APPROACH_THRESHOLD_PERCENT } from '@flow/shared';
import type { TierLimit } from '@/lib/actions/billing/enforce-tier-limit';

/** Resolve the contextual one-click upgrade target for the current tier.
 *  - free → pro (smallest commitment that removes the limit blocker)
 *  - pro → agency
 *  - agency → null (already unlimited; CTA is hidden)
 */
function getNextUpgradeTier(tier: SubscriptionTier): 'pro' | 'agency' | null {
  if (tier === 'free') return 'pro';
  if (tier === 'pro') return 'agency';
  return null;
}

interface UsageMeterProps {
  tier: SubscriptionTier;
  usage: { clients: number; teamMembers: number; agents: number };
  limits: TierLimit;
  upgradeAction: (input: unknown) => Promise<ActionResult<{ checkoutUrl: string }>>;
}

interface ItemProps {
  label: string;
  current: number;
  limit: number;
  isUnlimited: boolean;
  upgradeAction: UsageMeterProps['upgradeAction'];
  upgradeTier: 'pro' | 'agency' | null;
}

export function UsageMeter({ tier, usage, limits, upgradeAction }: UsageMeterProps) {
  const isAgency = tier === 'agency';
  const upgradeTier = getNextUpgradeTier(tier);
  return (
    <section className="space-y-3 rounded-[var(--flow-radius-lg)] border border-[var(--flow-color-border-default)] p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium text-[var(--flow-color-text-primary)]">Usage</h2>
        <span className="text-xs text-[var(--flow-color-text-muted)]">Plan: {tier}</span>
      </div>
      <UsageMeterItem label="Clients" current={usage.clients} limit={limits.maxClients} isUnlimited={isAgency} upgradeAction={upgradeAction} upgradeTier={upgradeTier} />
      <UsageMeterItem label="Team members" current={usage.teamMembers} limit={limits.maxTeamMembers} isUnlimited={isAgency} upgradeAction={upgradeAction} upgradeTier={upgradeTier} />
      <UsageMeterItem label="Agents" current={usage.agents} limit={limits.maxAgents} isUnlimited={isAgency} upgradeAction={upgradeAction} upgradeTier={upgradeTier} />
    </section>
  );
}

function UsageMeterItem({ label, current, limit, isUnlimited, upgradeAction, upgradeTier }: ItemProps) {
  const [state, formAction, isPending] = useActionState(
    async () => {
      if (!upgradeTier) return { success: false, error: { status: 400, code: 'INVALID_STATE', message: 'No upgrade available.', category: 'validation' as const } };
      const result = await upgradeAction({ targetTier: upgradeTier });
      if (result.success && typeof window !== 'undefined') {
        window.location.href = result.data.checkoutUrl;
      }
      return result;
    },
    null,
  );

  const errorMessage = state && !state.success ? state.error.message : null;

  if (isUnlimited) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--flow-color-text-secondary)]">{label}</span>
          <span className="font-medium text-[var(--flow-color-text-primary)]">{current} · Unlimited</span>
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((current / limit) * 100));
  const atLimit = current >= limit;
  const approaching = !atLimit && current >= Math.ceil(limit * APPROACH_THRESHOLD_PERCENT);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--flow-color-text-secondary)]">{label}</span>
        <span className="font-medium text-[var(--flow-color-text-primary)]">
          {current} / {limit}
          {atLimit && (
            <span className="ml-2 inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
              At limit
            </span>
          )}
          {approaching && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Approaching limit
            </span>
          )}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--flow-color-border-default)]">
        <div
          className={atLimit ? 'h-full bg-[var(--flow-status-error)]' : approaching ? 'h-full bg-amber-500' : 'h-full bg-[var(--flow-color-primary)]'}
          style={{ width: `${pct}%` }}
        />
      </div>
      {(atLimit || approaching) && upgradeTier && (
        <form action={formAction} className="pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="text-xs font-medium text-[var(--flow-color-primary)] underline disabled:opacity-50"
          >
            {isPending ? 'Redirecting…' : `Upgrade to ${upgradeTier === 'pro' ? 'Pro' : 'Agency'}`}
          </button>
        </form>
      )}
      {errorMessage && (
        <p className="text-xs text-[var(--flow-status-error)]" role="alert">{errorMessage}</p>
      )}
    </div>
  );
}
