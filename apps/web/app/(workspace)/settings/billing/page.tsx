/**
 * Billing settings page — Server Component (Story 9.3b, AC5 — FR55, FR58).
 *
 * Reads the workspace row (tier, status, period, cancel_at_period_end,
 * stripe_customer_id) and recent invoices via `getServerSupabase()` +
 * `requireTenantContext()`, then passes data to child client components
 * for interactivity. The page itself is a Server Component (default export,
 * no `"use client"` directive).
 *
 * Out of scope (deferred to 9-4 / 9-7): tier-limit enforcement badges,
 * 5% free-tier fee notice, full usage metering dashboard, dispute window
 * display, downgrade/cross-grade checkout flows.
 */
import type { Metadata } from 'next';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';
import { getTierConfig } from '@/lib/config/tier-config';
import { createCheckoutSessionAction } from '@/lib/actions/billing/create-checkout-session';
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
  planDisplayPrices: Record<'pro' | 'agency', { label: string; interval: string }>;
}

async function loadPageData(workspaceId: string): Promise<PageData | null> {
  const supabase = await getServerSupabase();
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
    .select('id, invoice_number, status, total_cents, amount_paid_cents, currency, issue_date')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(10);

  let planDisplayPrices: PageData['planDisplayPrices'];
  try {
    const tierConfig = await getTierConfig();
    planDisplayPrices = tierConfig.planDisplayPrices;
  } catch {
    planDisplayPrices = { pro: { label: '$29 / month', interval: 'month' }, agency: { label: '$99 / month', interval: 'month' } };
  }

  return {
    workspace: workspace as PageData['workspace'],
    recentInvoices: (invoiceRows ?? []) as unknown as BillingHistoryItem[],
    planDisplayPrices,
  };
}

// Inline Server Action wrappers — keeps the page a single deployable unit
// (project-context.md:315 — colocate with the route group).
async function handleCheckout(input: unknown): Promise<ActionResult<{ url: string }>> {
  'use server';
  return createCheckoutSessionAction(input);
}

async function handlePortal(input?: unknown): Promise<ActionResult<{ url: string }>> {
  'use server';
  return createPortalSessionAction(input);
}

async function handleCancel(input?: unknown): Promise<ActionResult<{ cancelAtPeriodEnd: true }>> {
  'use server';
  return cancelSubscriptionAction(input);
}

async function handleReactivate(input?: unknown): Promise<ActionResult<{ reactivated: true }>> {
  'use server';
  return reactivateSubscriptionAction(input);
}

async function handleSync(input: { sessionId?: string }): Promise<ActionResult<{ synced: true }>> {
  'use server';
  return syncStripeDataAction(input);
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ sync?: string; session_id?: string; status?: string }>;
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
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">Billing</h1>
        <p className="text-sm text-[var(--flow-status-error)]" role="alert">{error.message}</p>
      </div>
    );
  }

  const data = await loadPageData(ctx.workspaceId);
  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">Billing</h1>
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
      <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">Billing</h1>

      <SyncBanner
        isSyncRequested={isSyncRequested}
        isCancelReturn={isCancelReturn}
        sessionId={params.session_id}
        onSync={handleSync}
      />

      <section className="rounded-[var(--flow-radius-lg)] border border-[var(--flow-color-border-default)] p-5">
        <h2 className="text-lg font-medium text-[var(--flow-color-text-primary)]">Current plan</h2>
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
            {new Date(data.workspace.subscription_current_period_end).toLocaleDateString()}
          </p>
        )}
      </section>

      <PlanCard checkoutAction={handleCheckout} currentTier={data.workspace.subscription_tier} planDisplayPrices={data.planDisplayPrices} />

      <SubscriptionActions
        cancelAction={handleCancel}
        reactivateAction={handleReactivate}
        subscriptionStatus={data.workspace.subscription_status}
        cancelAtPeriodEnd={data.workspace.subscription_cancel_at_period_end}
      />

      <ManageBillingButton portalAction={handlePortal} hasCustomerId={!!data.workspace.stripe_customer_id} />

      <BillingHistory invoices={data.recentInvoices} />
    </div>
  );
}
