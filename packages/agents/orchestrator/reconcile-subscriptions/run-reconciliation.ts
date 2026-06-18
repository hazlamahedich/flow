/**
 * Subscription reconciliation (Story 9.5a — NFR54, spike §9.1).
 *
 * Compares Stripe's view of each subscription to our DB. When they disagree:
 *   1. Validates the transition via `transitionSubscriptionStatus` (pure).
 *   2. Calls `transition_workspace_subscription_status` (conditional write).
 *   3. Records drift / uncorrectable cases in the returned `ReconciliationReport`.
 *
 * System-level: uses `createServiceClient()` and `getPaymentProvider('stripe')`
 * (project-context.md:150). Sequential 100-row pages with a per-iteration
 * Stripe rate-limit sleep. Per-workspace error isolation (EC9) — one Stripe
 * outage does not fail the whole job.
 */
import { createServiceClient } from '@flow/db';
import { writeAuditLog } from '../../shared/audit-writer';
import { getPaymentProvider } from '../../providers';
import {
  mapStripeStatusToDb,
  transitionSubscriptionStatus,
} from '@flow/shared';
import type { ReconciliationReport, SubscriptionStatus } from '@flow/types';

const RECONCILE_BATCH_SIZE = 100;
const STRIPE_RATE_LIMIT_SLEEP_MS = 100;

interface ReconcileRow {
  id: string;
  subscription_status: SubscriptionStatus;
  stripe_subscription_id: string;
}

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
    .select('id, subscription_status, stripe_subscription_id')
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
    report.uncorrectable.push({
      workspaceId,
      reason: 'stripe_api_error',
    });
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
    report.uncorrectable.push({
      workspaceId,
      reason: 'unmapped_status',
    });
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
    return;
  }

  const validation = transitionSubscriptionStatus(dbStatus, mappedStatus);
  if (!validation.ok) {
    report.uncorrectable.push({
      workspaceId,
      reason: 'invalid_transition',
    });
    writeAuditLog({
      workspaceId,
      agentId: 'orchestrator',
      action: 'subscription.reconciliation_failed',
      entityType: 'workspace',
      entityId: workspaceId,
      details: { reason: 'invalid_transition', from: dbStatus, to: mappedStatus },
    });
    return;
  }

  let corrected = false;
  try {
    const rpcResult = await client.rpc('transition_workspace_subscription_status', {
      p_workspace_id: workspaceId,
      p_from_status: dbStatus,
      p_to_status: mappedStatus,
    });
    const data = (rpcResult.data ?? {}) as { success?: boolean; error?: string };
    if (rpcResult.error) {
      throw new Error(rpcResult.error.message ?? 'rpc_error');
    }
    if (data.error === 'PRECONDITION_FAILED') {
      corrected = false;
    } else if (data.success === true) {
      corrected = true;
    } else {
      throw new Error(data.error ?? 'unknown_rpc_response');
    }
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
}

/**
 * Nightly reconciliation entry point. Returns a `ReconciliationReport`
 * summarizing checked count, drift, and uncorrectable cases. The report IS
 * the failure surface — uncorrectable rows are surfaced for 9-7's
 * billing-accuracy dashboard rather than failing the job.
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
    const lastRow = page[page.length - 1];
    lastId = lastRow?.id ?? null;
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
