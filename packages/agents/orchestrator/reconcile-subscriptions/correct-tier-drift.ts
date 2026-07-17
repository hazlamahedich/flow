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
import {
  createServiceClient,
  bulkArchiveClients,
  countActiveClients,
} from '@flow/db';
import { PRD_FREE_MAX_CLIENTS } from '@flow/shared';
import { writeAuditLog } from '../../shared/audit-writer';
import type { SubscriptionStatus } from '@flow/shared';

export interface TierDriftRow {
  id: string;
  subscription_status: SubscriptionStatus;
  stripe_subscription_id: string;
  subscription_tier: 'free' | 'pro' | 'agency';
}

/**
 * Resolve the Free tier `maxClients` limit from `app_config`. The orchestrator
 * cannot depend on the Next.js app helper `getTierConfig()` (packages cannot
 * import apps/web), so it mirrors the pattern in `lifecycle-sweep.ts`.
 * Falls back to the PRD canonical value of 2 if config is unavailable.
 */
async function resolveFreeMaxClients(): Promise<number> {
  try {
    const client = createServiceClient();
    const result = await client
      .from('app_config')
      .select('key, value')
      .eq('key', 'tier_limits')
      .maybeSingle();
    if (result.error || !result.data) return PRD_FREE_MAX_CLIENTS;
    const raw = (result.data as { value?: unknown }).value;
    const parsed =
      typeof raw === 'string'
        ? (JSON.parse(raw) as Record<string, unknown>)
        : raw;
    const freeLimit = (parsed as Record<string, Record<string, number>>)?.free
      ?.maxClients;
    return typeof freeLimit === 'number' ? freeLimit : PRD_FREE_MAX_CLIENTS;
  } catch {
    return PRD_FREE_MAX_CLIENTS;
  }
}

/**
 * If the workspace is now `free` but still has more active clients than the
 * Free limit (webhook missed the downgrade archive), re-run the archive
 * here. Idempotent — if the archive already happened, this is a no-op.
 *
 * P15: reuses `bulkArchiveClients` and `countActiveClients` from `@flow/db`
 * so the archive ordering and logic stay in one place.
 */
export async function correctTierDrift(row: TierDriftRow): Promise<void> {
  if (row.subscription_tier !== 'free') return;

  const client = createServiceClient();
  const freeMaxClients = await resolveFreeMaxClients();

  // Race-with-reactivation safety: re-read the workspace tier inside the same
  // service-role client context before archiving. If the tier flipped back to
  // Pro/Agency between the sweep listing and this call, bail out.
  const { data: currentRow, error: currentError } = await client
    .from('workspaces')
    .select('subscription_tier')
    .eq('id', row.id)
    .maybeSingle();
  if (
    currentError ||
    !currentRow ||
    (currentRow as { subscription_tier: string }).subscription_tier !== 'free'
  ) {
    return;
  }

  const count = await countActiveClients(client, row.id);
  if (count <= freeMaxClients) return;

  const { archivedClientIds } = await bulkArchiveClients(
    client,
    row.id,
    freeMaxClients,
  );
  if (archivedClientIds.length === 0) return;

  writeAuditLog({
    workspaceId: row.id,
    agentId: 'orchestrator',
    action: 'subscription.tier_drift_corrected',
    entityType: 'workspace',
    entityId: row.id,
    details: { archivedClientIds, freeMaxClients, previousActiveCount: count },
  });
}
