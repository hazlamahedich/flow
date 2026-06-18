/**
 * Story 9.5b T4.5 — Tier-drift correction (extracted to keep
 * `run-reconciliation.ts` under the 200-line soft limit).
 *
 * `correctTierDrift(row)` re-runs the downgrade archive when the webhook
 * missed it (race / delivery failure). Idempotent — no-op when the archive
 * already happened.
 *
 * Uses `service_role` (the orchestrator context) so it bypasses RLS. Writes
 * a `subscription.tier_drift_corrected` audit log when it actually archives.
 */
import { createServiceClient } from '@flow/db';
import { writeAuditLog } from '../../shared/audit-writer';
import type { SubscriptionStatus } from '@flow/shared';

export interface TierDriftRow {
  id: string;
  subscription_status: SubscriptionStatus;
  stripe_subscription_id: string;
  subscription_tier: 'free' | 'pro' | 'agency';
}

interface TierConfigValue {
  tierLimits: { free: { maxClients: number | null } };
}

export const PRD_FREE_CLIENTS_FALLBACK = 2;

/**
 * If the workspace is now `free` but still has more active clients than the
 * Free limit (webhook missed the downgrade archive), re-run the archive
 * here. Idempotent — if the archive already happened, this is a no-op.
 */
export async function correctTierDrift(row: TierDriftRow): Promise<void> {
  if (row.subscription_tier !== 'free') return;

  const client = createServiceClient();

  let freeMaxClients = PRD_FREE_CLIENTS_FALLBACK;
  try {
    const { data: cfg } = await client
      .from('app_config')
      .select('value')
      .eq('key', 'tier_limits')
      .single();
    if (cfg) {
      const parsed = cfg.value as TierConfigValue;
      const limit = parsed?.tierLimits?.free?.maxClients;
      if (typeof limit === 'number') freeMaxClients = limit;
    }
  } catch {
    // fall through with PRD fallback (config IS seeded)
  }

  const { count, error: countError } = await client
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', row.id)
    .eq('status', 'active');
  if (countError || !count) return;

  if (count <= freeMaxClients) return;

  // MRU-LAST archive — mirror bulkArchiveClients ordering.
  const { data: activeIds, error: listError } = await client
    .from('clients')
    .select('id')
    .eq('workspace_id', row.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false });
  if (listError || !activeIds || activeIds.length === 0) return;

  const allIds = activeIds.map((r) => (r as { id: string }).id);
  const archiveIds = allIds.slice(freeMaxClients);
  if (archiveIds.length === 0) return;

  const { error: archiveError } = await client
    .from('clients')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .in('id', archiveIds)
    .eq('workspace_id', row.id)
    .eq('status', 'active');

  if (archiveError) {
    writeAuditLog({
      workspaceId: row.id,
      agentId: 'orchestrator',
      action: 'subscription.tier_drift_correction_failed',
      entityType: 'workspace',
      entityId: row.id,
      details: { reason: 'archive_update_failed', error: archiveError.message, excess: archiveIds.length },
    });
    return;
  }

  writeAuditLog({
    workspaceId: row.id,
    agentId: 'orchestrator',
    action: 'subscription.tier_drift_corrected',
    entityType: 'workspace',
    entityId: row.id,
    details: { archivedClientIds: archiveIds, freeMaxClients, previousActiveCount: count },
  });
}
