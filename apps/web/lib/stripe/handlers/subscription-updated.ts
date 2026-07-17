import type { SupabaseClient } from '@supabase/supabase-js';
import { getTierConfig } from '@/lib/config/tier-config';
import { mapStripeStatusToDb } from '@flow/shared';
import { StripePaymentProvider } from '@flow/agents/providers';
import { writeAuditLog } from '@flow/agents/shared/audit-writer';
import { applyDowngradeOnTierChange } from '@/lib/actions/billing/downgrade-internal';
import { applyAgencyToProDowngrade } from '@/lib/actions/billing/downgrade-agency-to-pro';
import { reactivateSuspendedMembers } from '@flow/db';
import type { WebhookEvent, WebhookProcessingResult } from '../webhook-types';

function getMetadata(object: Record<string, unknown>): Record<string, string> {
  const metadata = object.metadata ?? {};
  return typeof metadata === 'object' &&
    metadata !== null &&
    !Array.isArray(metadata)
    ? (metadata as Record<string, string>)
    : {};
}

async function findWorkspaceIdByCustomer(
  supabase: SupabaseClient,
  customerId: string,
): Promise<string | undefined> {
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return (data as Record<string, unknown> | null)?.id as string | undefined;
}

function mapPriceIdToTier(
  priceId: string,
  config: { stripePrices: { pro_monthly: string; agency_monthly: string } },
): 'pro' | 'agency' | undefined {
  if (config.stripePrices.pro_monthly === priceId) return 'pro';
  if (config.stripePrices.agency_monthly === priceId) return 'agency';
  return undefined;
}

function mapSubscriptionStatus(
  stripeStatus: string,
): 'active' | 'past_due' | 'cancelled' | undefined {
  // D4 decision: use the shared lifecycle helper as the single source of truth
  // for Stripe → DB status mapping. The helper returns null for unmapped or
  // transient states (e.g. 'incomplete'), which we treat as "skip this event".
  const mapped = mapStripeStatusToDb(stripeStatus);
  if (mapped === 'active' || mapped === 'past_due' || mapped === 'cancelled') {
    return mapped;
  }
  return undefined;
}

/**
 * Fetch the workspace's previous `subscription_tier` BEFORE the upsert flips
 * it. Used to detect downgrade (Pro|Agency → Free) and trigger
 * `applyDowngradeOnTierChange` (Story 9.5b AC3 — FR57 client half).
 *
 * Runs in the same webhook `service_role` context; returns `null` when the
 * workspace is missing or has no tier set yet.
 */
async function fetchPreviousTier(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<'free' | 'pro' | 'agency' | null> {
  const { data } = await supabase
    .from('workspaces')
    .select('subscription_tier')
    .eq('id', workspaceId)
    .maybeSingle();
  if (!data) return null;
  return (data as { subscription_tier: 'free' | 'pro' | 'agency' })
    .subscription_tier;
}

async function syncSubscriptionFromEvent(
  supabase: SupabaseClient,
  event: WebhookEvent,
): Promise<WebhookProcessingResult> {
  const object = event.data.object;
  const subscriptionId = object.id as string | undefined;
  const customerId = object.customer as string | undefined;
  const metadata = getMetadata(object);

  if (!subscriptionId || !customerId) {
    return { processed: false, reason: 'missing subscription id or customer' };
  }

  let workspaceId = metadata.workspace_id;
  if (!workspaceId) {
    workspaceId = await findWorkspaceIdByCustomer(supabase, customerId);
  }
  if (!workspaceId) {
    return {
      processed: false,
      reason: 'workspace not found for subscription event',
    };
  }

  // Capture the previous tier BEFORE the upsert flips it (Story 9.5b AC3).
  // Used to detect downgrade (Pro|Agency → Free) and trigger archive.
  const previousTier = await fetchPreviousTier(supabase, workspaceId);

  // `customer.subscription.updated` may carry a partial object (per spec dev
  // notes line 155). Expand via the provider to read full state.
  const provider = new StripePaymentProvider({
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  });
  const subscription = await provider.getSubscription(subscriptionId);

  const mappedStatus = mapSubscriptionStatus(subscription.status);
  if (!mappedStatus) {
    return {
      processed: false,
      reason: `unmapped subscription status: ${subscription.status}`,
    };
  }

  const priceIdValue = subscription.priceId;
  if (!priceIdValue) {
    return { processed: false, reason: 'subscription event missing price id' };
  }

  const config = await getTierConfig();
  const tier = mapPriceIdToTier(priceIdValue, config);
  if (!tier) {
    return {
      processed: false,
      reason: `price ${priceIdValue} does not map to a known tier`,
    };
  }
  const effectiveTier = tier as 'free' | 'pro' | 'agency';

  const periodStartMs = Date.parse(subscription.currentPeriodStart);
  const periodEndMs = Date.parse(subscription.currentPeriodEnd);
  const currentPeriodStart = Number.isNaN(periodStartMs)
    ? null
    : new Date(periodStartMs).toISOString();
  const currentPeriodEnd = Number.isNaN(periodEndMs)
    ? null
    : new Date(periodEndMs).toISOString();

  // (1) Tier-flip RPC (atomic row-level FOR UPDATE lock).
  const { error } = await supabase.rpc('upsert_workspace_subscription', {
    p_workspace_id: workspaceId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscriptionId,
    p_tier: tier,
    p_status: mappedStatus,
    p_current_period_start: currentPeriodStart,
    p_current_period_end: currentPeriodEnd,
    p_cancel_at_period_end: subscription.cancelAtPeriodEnd,
  });

  if (error) {
    return { processed: false, reason: error.message };
  }

  // (2) Story 9.5b AC3 — if the tier-flip is a downgrade to Free, archive
  // excess clients. The webhook ctx is the only legitimate bulk mutator
  // (`service_role` bypasses RLS — T4.6). We pass the same `supabase` client
  // so the caller can share a transaction when available. `tier_drift`
  // reconciliation covers missed webhooks (T4.5).
  if (
    effectiveTier === 'free' &&
    previousTier !== null &&
    (previousTier === 'pro' || previousTier === 'agency')
  ) {
    try {
      await applyDowngradeOnTierChange({
        workspaceId,
        fromTier: previousTier,
        toTier: 'free',
        supabase,
      });
    } catch (err) {
      // Non-fatal — tier flip already committed; archive failure surfaces
      // as tier_drift on next reconcileSubscriptions() run. Log via the
      // structured agent audit writer instead of stderr (project-context.md).
      writeAuditLog({
        workspaceId,
        agentId: 'stripe-webhook',
        action: 'subscription.downgrade_archive_failed',
        entityType: 'workspace',
        entityId: workspaceId,
        details: {
          previousTier,
          error: err instanceof Error ? err.message : String(err),
          reconcileFallback: true,
        },
      });
    }
  }

  // (2b) Story 9.5c AC2 — if the tier-flip is Agency→Pro, suspend excess team
  // members (FR57a). SIBLING of the Free path above (split, don't invert):
  // this branch is deliberately separate so 9-5b's locked tests stay green.
  // The webhook ctx is the only legitimate bulk mutator of non-active
  // membership states (`service_role` bypasses RLS — 20260717000002). The
  // handler is idempotent on replay (EC7) and best-effort on session
  // invalidation (EC6 — partial failure carries `warnings`, no rollback).
  if (effectiveTier === 'pro' && previousTier === 'agency') {
    try {
      await applyAgencyToProDowngrade({ workspaceId, supabase });
    } catch (err) {
      // Non-fatal — tier flip already committed. The tier_drift
      // reconciliation is the safety net for missed/partial webhooks.
      writeAuditLog({
        workspaceId,
        agentId: 'stripe-webhook',
        action: 'subscription.agency_to_pro_suspend_failed',
        entityType: 'workspace',
        entityId: workspaceId,
        details: {
          previousTier,
          error: err instanceof Error ? err.message : String(err),
          reconcileFallback: true,
        },
      });
    }
  }

  // (2c) Story 9.5c AC3 / Task 8 — if the tier-flip is Pro→Agency (upgrade-
  // back), reactivate any members that were suspended by a prior Agency→Pro
  // downgrade. FR57a reactivation clause. Minimal data-side hook: flips
  // status back to 'active', clears suspended_at/suspension_reason. The
  // bulk + per-member reactivation UX is owned by story 9-5f.
  // Idempotent: no-op when no suspended members exist.
  if (effectiveTier === 'agency' && previousTier === 'pro') {
    try {
      await reactivateSuspendedMembers(supabase, workspaceId);
    } catch (err) {
      // Non-fatal — tier flip already committed. Members remain suspended
      // and can be reactivated manually (or on a later webhook replay).
      writeAuditLog({
        workspaceId,
        agentId: 'stripe-webhook',
        action: 'subscription.pro_to_agency_reactivate_failed',
        entityType: 'workspace',
        entityId: workspaceId,
        details: {
          previousTier,
          error: err instanceof Error ? err.message : String(err),
          manualRecovery: true,
        },
      });
    }
  }

  return { processed: true };
}

export async function handleSubscriptionUpdated(
  supabase: SupabaseClient,
  event: WebhookEvent,
): Promise<WebhookProcessingResult> {
  return syncSubscriptionFromEvent(supabase, event);
}

export async function handleSubscriptionDeleted(
  supabase: SupabaseClient,
  event: WebhookEvent,
): Promise<WebhookProcessingResult> {
  const object = event.data.object;
  const subscriptionId = object.id as string | undefined;
  const customerId = object.customer as string | undefined;
  const metadata = getMetadata(object);

  if (!subscriptionId) {
    return { processed: false, reason: 'missing subscription id' };
  }

  let workspaceId = metadata.workspace_id;
  if (!workspaceId && customerId) {
    workspaceId = await findWorkspaceIdByCustomer(supabase, customerId);
  }
  if (!workspaceId) {
    return {
      processed: false,
      reason: 'missing workspace_id or customer for lookup',
    };
  }

  // FR59 + spike §6.1 — `customer.subscription.deleted` triggers the SUSPENSION
  // flow (30-day read-only window), NOT `cancelled`. The workspace enters
  // `suspended` regardless of whether it was `active`, `past_due`, or
  // `cancelled` (owner-scheduled cancel-at-period-end whose period has ended).
  // The single conditional write handles all three source states idempotently:
  // a duplicate webhook delivery on an already-`suspended` or `deleted` row
  // returns `PRECONDITION_FAILED`, which we treat as `processed:true`
  // (project-context.md:494 — "already in target state = success").
  const { error } = await supabase.rpc('transition_to_suspended_any', {
    p_workspace_id: workspaceId,
  });

  if (error) {
    return { processed: false, reason: error.message };
  }

  return { processed: true };
}
