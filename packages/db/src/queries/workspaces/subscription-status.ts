/**
 * Workspace subscription-status read helpers (Story 9.5b — FR60).
 *
 * Used by the orchestrator (PgBossWorker.claim) to decide whether agent
 * execution may proceed for a given workspace.
 *
 * Architecture (project-context.md:150):
 * - `service_role` only — the orchestrator runs in agent-execution context,
 *   not user-facing context. RLS would block service-role reads here only
 *   if the column were mislabeled; the RPC + bypass suffice.
 * - Never call this from a Server Action / route handler — use
 *   `getServerSupabase()` there.
 */
import { createServiceClient } from '../../client';
import type { SubscriptionStatus } from '@flow/types';

interface WorkspaceStatusRow {
  subscription_status: SubscriptionStatus;
}

/**
 * Returns the workspace's current `subscription_status`, or `null` when the
 * workspace row is missing / RLS-hidden.
 *
 * The orchestrator guard treats `null` as "don't run" (defensive — EC5).
 */
export async function getWorkspaceSubscriptionStatus(
  workspaceId: string,
): Promise<SubscriptionStatus | null> {
  if (!workspaceId) return null;
  const client = createServiceClient();
  const { data, error } = await client
    .from('workspaces')
    .select('subscription_status')
    .eq('id', workspaceId)
    .maybeSingle();

  if (error) return null;
  if (!data) return null;
  return (data as WorkspaceStatusRow).subscription_status;
}
