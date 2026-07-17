/**
 * Billing settings page — Server Component (Story 9.3b + 9.4).
 *
 * Reads the workspace row (tier, status, period, cancel_at_period_end,
 * stripe_customer_id), recent invoices, AND usage counts (Story 9.4 AC6 —
 * clients / team members / agents) via `getServerSupabase()` +
 * `requireTenantContext()`, then passes data to child client components for
 * interactivity. The page itself is a Server Component (default export,
 * no `"use client"` directive).
 *
 * 9.4 additions:
 *   - Usage-vs-limits display via `UsageMeter` (AC6, FR55/FR56)
 *   - One-click upgrade via `changeTierAction` (AC4, FR62)
 *
 * Out of scope (deferred to 9-7): full usage metering dashboard, dispute
 * window display.
 */
import type { Metadata } from 'next';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  createServiceClient,
  countActiveClients,
  countArchivedClients,
  getLatestArchivedAt,
  countActiveTeamMembers,
  countSuspendedMembers,
  countActiveAgents,
} from '@flow/db';
import type { ActionResult, SubscriptionTier } from '@flow/types';
import { getTierConfig, getProTeamMemberLimit } from '@/lib/config/tier-config';
import {
  getTierLimits,
  type TierLimit,
} from '@/lib/actions/billing/enforce-tier-limit';
import { createCheckoutSessionAction } from '@/lib/actions/billing/create-checkout-session';
import { changeTierAction } from '@/lib/actions/billing/change-tier';
import { createPortalSessionAction } from '@/lib/actions/billing/create-portal-session';
import {
  cancelSubscriptionAction,
  reactivateSubscriptionAction,
} from '@/lib/actions/billing/subscription-manage';
import { syncStripeDataAction } from '@/lib/actions/billing/sync-stripe-data';
import { PlanCard } from './components/PlanCard';
import { ManageBillingButton } from './components/ManageBillingButton';
import { SubscriptionActions } from './components/SubscriptionActions';
import { BillingHistory } from './components/BillingHistory';
import { SyncBanner } from './components/SyncBanner';
import { UsageMeter } from './components/UsageMeter';
import { DowngradeBanner } from './components/DowngradeBanner';
import { AgencyDowngradeHeadsup } from './components/AgencyDowngradeHeadsup';
import { SuspendedMembersBanner } from './components/SuspendedMembersBanner';

export const metadata: Metadata = {
  title: 'Billing',
};

export const dynamic = 'force-dynamic';

interface BillingHistoryItem {
  id: string;
  invoiceNumber: string;
  status: string;
  totalCents: number;
  amountPaidCents: number;
  currency: string;
  issueDate: string;
}

interface PageData {
  workspace: {
    subscription_tier: string;
    subscription_status: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    subscription_current_period_start: string | null;
    subscription_current_period_end: string | null;
    subscription_cancel_at_period_end: boolean;
  };
  recentInvoices: BillingHistoryItem[];
  planDisplayPrices: Record<
    'pro' | 'agency',
    { label: string; interval: string }
  >;
  usage: { clients: number; teamMembers: number; agents: number };
  archived: { count: number; latestArchivedAt: string | null };
  tierLimits: TierLimit;
  /** Pro plan team-member limit, for the Agency→Pro downgrade heads-up (9-5c). */
  proTeamMemberLimit: number;
  /** Count of suspended team members (status='suspended') — for the AC4 banner. Read via service_role. */
  suspendedMembersCount: number;
}

async function loadPageData(
  workspaceId: string,
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
): Promise<PageData | null> {
  const { data: workspace } = await supabase
    .from('workspaces')
    .select(
      'subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_current_period_start, subscription_current_period_end, subscription_cancel_at_period_end',
    )
    .eq('id', workspaceId)
    .maybeSingle();
  if (!workspace) return null;

  const { data: invoiceRows } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, status, total_cents, amount_paid_cents, currency, issue_date',
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(10);

  let planDisplayPrices: PageData['planDisplayPrices'];
  let tierLimits: TierLimit;
  let proTeamMemberLimit: number;
  try {
    const tierConfig = await getTierConfig();
    planDisplayPrices = tierConfig.planDisplayPrices;
    tierLimits = await getTierLimits(
      workspace.subscription_tier as SubscriptionTier,
    );
    // 9-5c AC1: Pro team-member limit for the downgrade heads-up. Sourced
    // from the shared helper (PD1 = 5) so the page and the webhook agree on
    // the same fallback (review M4).
    proTeamMemberLimit = await getProTeamMemberLimit();
  } catch {
    planDisplayPrices = {
      pro: { label: '$29 / month', interval: 'month' },
      agency: { label: '$99 / month', interval: 'month' },
    };
    tierLimits = { maxClients: 5, maxTeamMembers: 1, maxAgents: 2 };
    proTeamMemberLimit = 5;
  }

  // Usage counts use the same RLS-safe helpers consumed by enforceTierLimit
  // (Story 9.4 AC6 — do not duplicate count logic). All three accept the
  // user-scoped supabase client.
  const [clients, archivedCount, latestArchivedAt, teamMembers, agents] =
    await Promise.all([
      countActiveClients(supabase, workspaceId).catch(() => 0),
      countArchivedClients(supabase, workspaceId).catch(() => 0),
      getLatestArchivedAt(supabase, workspaceId).catch(() => null),
      countActiveTeamMembers(supabase, workspaceId).catch(() => 0),
      countActiveAgents(supabase, workspaceId).catch(() => 0),
    ]);

  // 9-5c AC4 — suspended-member count for the dual-placement banner. Read via
  // service_role because the owner_all + admin_select RLS policies gate SELECT
  // on status='active' (a user JWT returns 0 even for owners). service_role is
  // the same pattern used by getTierConfig for app_config reads.
  const suspendedMembersCount = await countSuspendedMembers(
    createServiceClient(),
    workspaceId,
  ).catch(() => 0);

  return {
    workspace: workspace as PageData['workspace'],
    recentInvoices: (invoiceRows ?? []) as unknown as BillingHistoryItem[],
    planDisplayPrices,
    usage: { clients, teamMembers, agents },
    archived: { count: archivedCount, latestArchivedAt },
    tierLimits,
    proTeamMemberLimit,
    suspendedMembersCount,
  };
}

// Inline Server Action wrappers — keeps the page a single deployable unit
// (project-context.md:315 — colocate with the route group).
async function handleCheckout(
  input: unknown,
): Promise<ActionResult<{ url: string }>> {
  'use server';
  return createCheckoutSessionAction(input);
}

async function handleUpgrade(
  input: unknown,
): Promise<ActionResult<{ checkoutUrl: string }>> {
  'use server';
  return changeTierAction(input);
}

async function handlePortal(
  input?: unknown,
): Promise<ActionResult<{ url: string }>> {
  'use server';
  return createPortalSessionAction(input);
}

async function handleCancel(
  input?: unknown,
): Promise<ActionResult<{ cancelAtPeriodEnd: true }>> {
  'use server';
  return cancelSubscriptionAction(input);
}

async function handleReactivate(
  input?: unknown,
): Promise<ActionResult<{ reactivated: true }>> {
  'use server';
  return reactivateSubscriptionAction(input);
}

async function handleSync(input: {
  sessionId?: string;
}): Promise<ActionResult<{ synced: true }>> {
  'use server';
  return syncStripeDataAction(input);
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    sync?: string;
    session_id?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await getServerSupabase();

  let ctx;
  try {
    ctx = await requireTenantContext(supabase);
  } catch (err) {
    const error = err as ReturnType<typeof createFlowError>;
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Billing
        </h1>
        <p className="text-sm text-[var(--flow-status-error)]" role="alert">
          {error.message}
        </p>
      </div>
    );
  }

  const data = await loadPageData(ctx.workspaceId, supabase);
  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Billing
        </h1>
        <p className="text-sm text-[var(--flow-status-error)]" role="alert">
          Failed to load billing data. Please try again.
        </p>
      </div>
    );
  }

  const isSyncRequested = params.sync === '1';
  const isCancelReturn = params.status === 'cancel';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
        Billing
      </h1>

      <SyncBanner
        isSyncRequested={isSyncRequested}
        isCancelReturn={isCancelReturn}
        sessionId={params.session_id}
        onSync={handleSync}
      />

      {/* Story 9.5b AC4 — auto-upgrade prompt after downgrade (FR57). */}
      <DowngradeBanner
        archivedCount={data.archived.count}
        archivedAt={data.archived.latestArchivedAt}
        workspaceId={ctx.workspaceId}
        onUpgrade={handleUpgrade}
      />

      {/* Story 9.5c AC1 (Option B) — proactive heads-up for Agency owners
          over the Pro team-member limit, before they downgrade via the
          Stripe Customer Portal. FR57a. */}
      <AgencyDowngradeHeadsup
        currentTier={data.workspace.subscription_tier}
        activeTeamMemberCount={data.usage.teamMembers}
        proTeamMemberLimit={data.proTeamMemberLimit}
      />

      {/* Story 9.5c AC4 — owner-facing banner when suspended members exist
          (prior Agency→Pro downgrade). Dual placement: here on billing, and
          on the team settings page. FR57a. */}
      <SuspendedMembersBanner
        suspendedCount={data.suspendedMembersCount}
        proTeamMemberLimit={data.proTeamMemberLimit}
        placement="billing"
      />

      <section className="rounded-[var(--flow-radius-lg)] border border-[var(--flow-color-border-default)] p-5">
        <h2 className="text-lg font-medium text-[var(--flow-color-text-primary)]">
          Current plan
        </h2>
        <p className="mt-1 text-sm text-[var(--flow-color-text-secondary)]">
          Tier:{' '}
          <span className="font-medium text-[var(--flow-color-text-primary)]">
            {data.workspace.subscription_tier}
          </span>{' '}
          · Status:{' '}
          <span className="font-medium text-[var(--flow-color-text-primary)]">
            {data.workspace.subscription_status}
          </span>
          {data.workspace.subscription_cancel_at_period_end && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Cancels at period end
            </span>
          )}
        </p>
        {data.workspace.subscription_current_period_end && (
          <p className="mt-1 text-xs text-[var(--flow-color-text-muted)]">
            Current period ends{' '}
            {new Date(
              data.workspace.subscription_current_period_end,
            ).toLocaleDateString()}
          </p>
        )}
      </section>

      <PlanCard
        checkoutAction={handleCheckout}
        currentTier={data.workspace.subscription_tier}
        planDisplayPrices={data.planDisplayPrices}
      />

      <UsageMeter
        tier={data.workspace.subscription_tier as SubscriptionTier}
        usage={data.usage}
        limits={data.tierLimits}
        upgradeAction={handleUpgrade}
      />

      <SubscriptionActions
        cancelAction={handleCancel}
        reactivateAction={handleReactivate}
        subscriptionStatus={data.workspace.subscription_status}
        cancelAtPeriodEnd={data.workspace.subscription_cancel_at_period_end}
      />

      <ManageBillingButton
        portalAction={handlePortal}
        hasCustomerId={!!data.workspace.stripe_customer_id}
      />

      <BillingHistory invoices={data.recentInvoices} />
    </div>
  );
}
