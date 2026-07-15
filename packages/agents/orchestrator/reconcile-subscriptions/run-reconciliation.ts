/**
 * Subscription reconciliation (Story 9.5a — NFR54, spike §9.1).
 *
 * Compares Stripe's view of each subscription to our DB. When they disagree:
 * validates the transition (pure) → calls `transition_workspace_subscription_status`
 * (conditional write) → records drift / uncorrectable in the returned report.
 * System-level (`service_role`); sequential 100-row pages with Stripe
 * rate-limit sleep. Per-workspace error isolation (EC9).
 *
 * Story 9.5b T4.5 — also runs `correctTierDrift` (in `correct-tier-drift.ts`)
 * to catch downgrade archives the webhook missed.
 */
import { createServiceClient } from '@flow/db';
import { writeAuditLog } from '../../shared/audit-writer';
import { getPaymentProvider } from '../../providers';
import {
  mapStripeStatusToDb,
  transitionSubscriptionStatus,
} from '@flow/shared';
import type { ReconciliationReport } from '@flow/types';
import { correctTierDrift, type TierDriftRow } from './correct-tier-drift';

const RECONCILE_BATCH_SIZE = 100;
const STRIPE_RATE_LIMIT_SLEEP_MS = 100;

type ReconcileRow = TierDriftRow;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a single page of workspaces that need reconciliation. Excludes
 * `deleted` rows (terminal) and rows without a `stripe_subscription_id`.
 * Ordered by `id` for deterministic pagination.
 */
async function fetchWorkspacesToReconcilePage(
  fromId: string | null,
): Promise<ReconcileRow[]> {
  const client = createServiceClient();
  let query = client
    .from('workspaces')
    .select(
      'id, subscription_status, stripe_subscription_id, subscription_tier',
    )
    .neq('subscription_status', 'deleted')
    .not('stripe_subscription_id', 'is', null)
    .order('id', { ascending: true })
    .limit(RECONCILE_BATCH_SIZE);

  if (fromId) {
    query = query.gt('id', fromId);
  }

  const result = await query;
  if (result.error) {
    throw new Error(String(result.error));
  }

  const rows = (result.data as ReconcileRow[] | null) ?? [];
  return rows.filter(
    (r) => r.subscription_status !== 'deleted' && !!r.stripe_subscription_id,
  );
}

/**
 * Reconciles a single workspace. Mutates `report` in place.
 */
async function reconcileWorkspace(
  row: ReconcileRow,
  report: ReconciliationReport,
): Promise<void> {
  const client = createServiceClient();
  const workspaceId = row.id;
  const dbStatus = row.subscription_status;

  let stripeStatus: string;
  try {
    const subscription = await getPaymentProvider('stripe').getSubscription(
      row.stripe_subscription_id,
    );
    stripeStatus = subscription.status;
    await sleep(STRIPE_RATE_LIMIT_SLEEP_MS);
  } catch (err) {
    report.uncorrectable.push({ workspaceId, reason: 'stripe_api_error' });
    writeAuditLog({
      workspaceId,
      agentId: 'orchestrator',
      action: 'subscription.reconciliation_failed',
      entityType: 'workspace',
      entityId: workspaceId,
      details: { reason: 'stripe_api_error', error: String(err) },
    });
    return;
  }

  const mappedStatus = mapStripeStatusToDb(stripeStatus);
  if (!mappedStatus) {
    report.uncorrectable.push({ workspaceId, reason: 'unmapped_status' });
    writeAuditLog({
      workspaceId,
      agentId: 'orchestrator',
      action: 'subscription.reconciliation_failed',
      entityType: 'workspace',
      entityId: workspaceId,
      details: { reason: 'unmapped_status', stripeStatus },
    });
    return;
  }

  if (mappedStatus === dbStatus) {
    // Story 9.5b T4.5 — status matches, but tier_drift might still exist
    // (webhook missed the archive, or count changed after the flip).
    await correctTierDrift(row);
    return;
  }

  const validation = transitionSubscriptionStatus(dbStatus, mappedStatus);
  if (!validation.ok) {
    report.uncorrectable.push({ workspaceId, reason: 'invalid_transition' });
    writeAuditLog({
      workspaceId,
      agentId: 'orchestrator',
      action: 'subscription.reconciliation_failed',
      entityType: 'workspace',
      entityId: workspaceId,
      details: {
        reason: 'invalid_transition',
        from: dbStatus,
        to: mappedStatus,
      },
    });
    return;
  }

  let corrected = false;
  try {
    const rpcResult = await client.rpc(
      'transition_workspace_subscription_status',
      {
        p_workspace_id: workspaceId,
        p_from_status: dbStatus,
        p_to_status: mappedStatus,
      },
    );
    const data = (rpcResult.data ?? {}) as {
      success?: boolean;
      error?: string;
    };
    if (rpcResult.error)
      throw new Error(rpcResult.error.message ?? 'rpc_error');
    if (data.error === 'PRECONDITION_FAILED') corrected = false;
    else if (data.success === true) corrected = true;
    else throw new Error(data.error ?? 'unknown_rpc_response');
  } catch (err) {
    report.uncorrectable.push({
      workspaceId,
      reason: 'status_changed_before_reconcile',
    });
    writeAuditLog({
      workspaceId,
      agentId: 'orchestrator',
      action: 'subscription.reconciliation_failed',
      entityType: 'workspace',
      entityId: workspaceId,
      details: {
        reason: 'status_changed_before_reconcile',
        error: String(err),
      },
    });
    return;
  }

  report.drift.push({
    workspaceId,
    fromStatus: dbStatus,
    toStatus: mappedStatus,
    corrected,
  });

  if (corrected) {
    writeAuditLog({
      workspaceId,
      agentId: 'orchestrator',
      action: 'subscription.reconciled',
      entityType: 'workspace',
      entityId: workspaceId,
      details: { from: dbStatus, to: mappedStatus },
    });
  }

  // Story 9.5b T4.5 — regardless of status drift, also check tier_drift.
  await correctTierDrift(row);
}

/**
 * Nightly reconciliation entry point. Returns a `ReconciliationReport`
 * summarizing checked count, drift, and uncorrectable cases.
 */
export async function runReconciliation(): Promise<ReconciliationReport> {
  const report: ReconciliationReport = {
    checked: 0,
    drift: [],
    uncorrectable: [],
  };
  let lastId: string | null = null;
  let page: ReconcileRow[];

  do {
    page = await fetchWorkspacesToReconcilePage(lastId);
    for (const row of page) {
      report.checked += 1;
      try {
        await reconcileWorkspace(row, report);
      } catch (err) {
        report.uncorrectable.push({
          workspaceId: row.id,
          reason: 'unexpected_error',
        });
        writeAuditLog({
          workspaceId: row.id,
          agentId: 'orchestrator',
          action: 'subscription.reconciliation_failed',
          entityType: 'workspace',
          entityId: row.id,
          details: { reason: 'unexpected_error', error: String(err) },
        });
      }
    }
    lastId = page[page.length - 1]?.id ?? null;
  } while (page.length === RECONCILE_BATCH_SIZE);

  writeAuditLog({
    workspaceId: 'system',
    agentId: 'orchestrator',
    action: 'subscription.reconciliation_complete',
    entityType: 'orchestrator',
    details: {
      checked: report.checked,
      driftCount: report.drift.length,
      uncorrectableCount: report.uncorrectable.length,
    },
  });

  return report;
}
