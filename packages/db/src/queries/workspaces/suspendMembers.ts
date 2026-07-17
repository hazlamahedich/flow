/**
 * Bulk member suspender (Story 9.5c AC2/AC3 — FR57a team-member half).
 *
 * `bulkSuspendMembers` suspends the lowest-priority active members so that
 * at most `keepLimit` active members remain, when a workspace downgrades
 * from Agency to Pro and exceeds the Pro team-member limit. Used by
 * `applyAgencyToProDowngrade` on the Stripe `customer.subscription.updated`
 * webhook path (Agency→Pro tier flip).
 *
 * Naming: this is a NEW bulk helper, distinct from the existing singular
 * `revokeMember` at `apps/web/.../team/actions/revoke-member.ts` (user-facing
 * single-member revoke). Same table, different shape + different mutator
 * context (webhook service_role vs user JWT).
 *
 * Templated on `packages/db/src/queries/clients/archiveClients.ts` (9-5b's
 * `bulkArchiveClients`), but with role-priority ordering instead of MRU.
 *
 * Runs in the Stripe webhook context: caller passes a `service_role` client
 * to bypass RLS (project-context.md:195 — RLS is the security perimeter; the
 * webhook is the only legitimate bulk mutator of non-active states).
 *
 * The suspended rows are NEVER deleted (EC7) — only their `status` flips to
 * `suspended`, `suspended_at` is set, and `suspension_reason` is recorded.
 * `removed_at` is intentionally NOT set (that would conflate with `revoked`).
 *
 * Idempotency (EC7): re-invocation on an already-compliant workspace is a
 * no-op — `countActiveTeamMembers` filters `.eq('status','active')`, so a
 * replay after suspension counts only the remaining active members and
 * returns `suspendedMemberIds: []` if the workspace is already within limit.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface BulkSuspendResult {
  suspendedMemberIds: string[];
  preservedCount: number;
}

/**
 * Result of reactivating suspended members on upgrade-back to Agency
 * (Story 9.5c AC3 / Task 8 — FR57a reactivation clause).
 */
export interface ReactivateResult {
  reactivatedMemberIds: string[];
}

/**
 * Role priority weights for the default-suggestion sort (PD3, codified in
 * `prd.md:814`). Lower number = higher priority = preserved first.
 * `owner > admin > member > client_user`. Exported so tests can verify the
 * ordering without triggering an UPDATE.
 */
export const ROLE_PRIORITY: Record<string, number> = {
  owner: 0,
  admin: 1,
  member: 2,
  client_user: 3,
};

interface ActiveMemberRow {
  id: string;
  role: string;
  joined_at: string;
  user_id: string;
}

/**
 * Fetch the active member IDs for a workspace ordered by the role-priority
 * default suggestion (PD3): role weight `owner > admin > member > client_user`,
 * then `joined_at ASC` (longest-tenured first), final tiebreaker `user_id ASC`
 * (deterministic — needed because `timestamptz` collisions are possible under
 * bulk import). Exported so tests can verify the ordering without an UPDATE.
 *
 * The owner-first ordering guarantees owners are never suspended (AC3): they
 * sort to the front of the list and the suspend set is the tail.
 */
export async function listActiveMembersByRolePriority(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('id, role, joined_at, user_id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');

  if (error) throw error;

  const rows = (data ?? []) as unknown as ActiveMemberRow[];

  // Stable sort by (role weight ASC, joined_at ASC, user_id ASC).
  // The Array.prototype.sort is stable in Node 12+ (V8 Timsort), so equal
  // keys preserve insertion order — the user_id tiebreaker is a final
  // guarantee of determinism across bulk-import timestamptz collisions.
  const weight = (role: string): number =>
    ROLE_PRIORITY[role] ?? Number.MAX_SAFE_INTEGER;
  rows.sort((a, b) => {
    const w = weight(a.role) - weight(b.role);
    if (w !== 0) return w;
    const j = a.joined_at.localeCompare(b.joined_at);
    if (j !== 0) return j;
    return a.user_id.localeCompare(b.user_id);
  });

  return rows.map((r) => r.id);
}

/**
 * Suspend the lowest-priority active members so that at most `keepLimit`
 * active members remain. Returns the suspended member IDs (tail of the
 * role-priority-sorted list) and the count of preserved (kept-active) members.
 *
 * No-op when `keepLimit >= currentActive` (no excess) — returns
 * `suspendedMemberIds: []`. This also makes the helper idempotent on webhook
 * replay (EC7): after the first invocation suspends the excess, a replay
 * counts only the remaining active members and suspends none.
 *
 * @param reason Machine-readable categorization for audit/analytics
 *   (e.g. `'tier_downgrade_agency_to_pro'`). NOT user-facing copy — user
 *   copy lives in the notification templates (AC5).
 *
 * @example
 *   const { suspendedMemberIds, preservedCount } = await bulkSuspendMembers(
 *     serviceClient, workspaceId, proLimit, 'tier_downgrade_agency_to_pro',
 *   );
 */
export async function bulkSuspendMembers(
  supabase: SupabaseClient,
  workspaceId: string,
  keepLimit: number,
  reason: string,
): Promise<BulkSuspendResult> {
  const allIds = await listActiveMembersByRolePriority(supabase, workspaceId);
  if (allIds.length <= keepLimit) {
    return { suspendedMemberIds: [], preservedCount: allIds.length };
  }

  const preservedIds = allIds.slice(0, keepLimit);
  const suspendIds = allIds.slice(keepLimit);

  if (suspendIds.length === 0) {
    return { suspendedMemberIds: [], preservedCount: preservedIds.length };
  }

  const suspendedAt = new Date().toISOString();
  const { error } = await supabase
    .from('workspace_members')
    .update({
      status: 'suspended',
      suspended_at: suspendedAt,
      suspension_reason: reason,
      // Explicitly leave removed_at untouched — suspension must NOT conflate
      // with revocation. The row stays in place; reactivation flips it back.
    })
    .in('id', suspendIds)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');

  if (error) throw error;

  return {
    suspendedMemberIds: suspendIds,
    preservedCount: preservedIds.length,
  };
}

/**
 * Reactivate all suspended members in a workspace — the data-side hook for
 * upgrade-back to Agency (Story 9.5c AC3 / Task 8 — FR57a reactivation).
 *
 * Flips `status` back to `'active'` and clears `suspended_at` +
 * `suspension_reason` for every suspended row in the workspace. No-op when
 * there are no suspended members. Idempotent: a second invocation finds no
 * suspended rows and returns `reactivatedMemberIds: []`.
 *
 * Runs in the Stripe webhook `service_role` context (caller passes a
 * service_role client) — user JWTs cannot mutate non-active states (the
 * owner_all UPDATE policy gates on `status='active'`; migration
 * `20260717000002`). Bulk reactivation UX (one-click restore-all, per-member
 * picker, "you're back" email) is deferred to story 9-5f.
 *
 * @example
 *   const { reactivatedMemberIds } = await reactivateSuspendedMembers(
 *     serviceClient, workspaceId,
 *   );
 */
export async function reactivateSuspendedMembers(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<ReactivateResult> {
  // Fetch the suspended member IDs first (the UPDATE returns rows on
  // supabase-js only when `returning: 'representation'` is set; selecting
  // first keeps this portable across client versions + gives us the IDs
  // for the audit/notification path).
  const { data, error: selectError } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'suspended');

  if (selectError) throw selectError;

  const suspendedIds = ((data ?? []) as unknown as { id: string }[]).map(
    (r) => r.id,
  );

  if (suspendedIds.length === 0) {
    return { reactivatedMemberIds: [] };
  }

  const { error: updateError } = await supabase
    .from('workspace_members')
    .update({
      status: 'active',
      suspended_at: null,
      suspension_reason: null,
    })
    .in('id', suspendedIds)
    .eq('workspace_id', workspaceId)
    .eq('status', 'suspended');

  if (updateError) throw updateError;

  return { reactivatedMemberIds: suspendedIds };
}
