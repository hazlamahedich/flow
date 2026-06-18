/**
 * Bulk client archiver (Story 9.5b AC3 — FR57 client half).
 *
 * `bulkArchiveClients` archives the LEAST-recently-active clients first
 * (MRU-LAST), preserving the workspace's most-active relationships. Used by
 * `applyDowngradeOnTierChange` when a Pro/Agency workspace downgrades to
 * Free and exceeds the Free client limit.
 *
 * Naming: this is a NEW bulk helper, distinct from the existing singular
 * `archiveClient` at `crud.ts` (used by the user-facing client-actions
 * path). Same table, different shape — bulk uses an `id IN (...)` update.
 *
 * Runs in the Stripe webhook context: caller passes a `service_role`
 * client to bypass RLS (project-context.md:195 — RLS is the security
 * perimeter; the webhook is the only legitimate bulk mutator).
 *
 * The archived rows are NEVER deleted (EC7) — only their `status` flips
 * to `archived` and `archived_at` is set.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface BulkArchiveResult {
  archivedClientIds: string[];
  preservedCount: number;
}

/**
 * Fetch the active client IDs for a workspace ordered MRU-FIRST (most
 * recently-updated first). Used to compute the keep-set (top N) vs the
 * archive-set (tail). Exported so tests can verify the ordering without
 * triggering an UPDATE.
 *
 * Ordering by `updated_at DESC` is the MRU proxy — it captures the most
 * recently-edited / billed / communicated clients. `created_at ASC` was
 * rejected (it archived flagship clients — a churn risk per Mary's review).
 */
export async function listActiveClientIdsMruFirst(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}

/**
 * Archive the least-recently-active clients so that at most `keepLimit`
 * active clients remain. Returns the archived IDs (tail of the MRU-sorted
 * list) and the count of preserved (kept-active) clients.
 *
 * No-op when `keepLimit >= currentActive` (no excess).
 */
export async function bulkArchiveClients(
  supabase: SupabaseClient,
  workspaceId: string,
  keepLimit: number,
): Promise<BulkArchiveResult> {
  const allIds = await listActiveClientIdsMruFirst(supabase, workspaceId);
  if (allIds.length <= keepLimit) {
    return { archivedClientIds: [], preservedCount: allIds.length };
  }

  const preservedIds = allIds.slice(0, keepLimit);
  const archiveIds = allIds.slice(keepLimit);

  if (archiveIds.length === 0) {
    return { archivedClientIds: [], preservedCount: preservedIds.length };
  }

  const archivedAt = new Date().toISOString();
  const { error } = await supabase
    .from('clients')
    .update({ status: 'archived', archived_at: archivedAt })
    .in('id', archiveIds)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');

  if (error) throw error;

  return { archivedClientIds: archiveIds, preservedCount: preservedIds.length };
}
