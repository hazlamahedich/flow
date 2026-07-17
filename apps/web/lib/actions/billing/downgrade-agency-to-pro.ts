/**
 * Agency→Pro downgrade webhook handler (Story 9.5c AC2 — FR57a).
 *
 * `applyAgencyToProDowngrade` is an INTERNAL function (NOT a Server Action)
 * invoked by the Stripe `customer.subscription.updated` webhook handler
 * (`apps/web/lib/stripe/handlers/subscription-updated.ts`) AFTER the
 * tier-flip RPC `upsert_workspace_subscription`, when the workspace flips
 * from `agency` to `pro` and exceeds the Pro team-member limit.
 *
 * SIBLING of `applyDowngradeOnTierChange` (9-5b, Free path) — split, don't
 * invert. This function is intentionally separate so 9-5b's locked tests
 * stay green. Do NOT widen `downgradeSchema.toTier`; do NOT flip the 9-5b
 * EC4 rejection predicate.
 *
 * Behavior:
 *  - Reads the Pro team-member limit from `getTierConfig()` (PD1: 5).
 *  - Counts active members via `countActiveTeamMembers`.
 *  - When `activeCount > proLimit`, suspends the excess via
 *    `bulkSuspendMembers` (role-priority sort, PD3). No data is deleted.
 *  - Calls `invalidateUserSessions` per suspended member — best-effort,
 *    observable (Murat P0-1). Partial failure does NOT roll back the DB
 *    writes; the response carries `warnings: ['session_invalidation_partial']`
 *    and the audit row records `sessionsAttempted` / `sessionsConfirmed`.
 *  - Revalidates `workspace_member` + `workspace_client` cache tags.
 *  - Returns a NEW `AgencyToProDowngradeResult` shape (do NOT conflate with
 *    the 9-5b `DowngradeResult`).
 *
 * Idempotent (EC7): re-invocation after the workspace is within limit is a
 * no-op (`bulkSuspendMembers` returns `suspendedMemberIds: []`).
 *
 * NOTE: This module is imported by the webhook handler and runs in
 * `service_role` context. It does NOT call `requireTenantContext`.
 */
import { revalidateTag } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createServiceClient,
  bulkSuspendMembers,
  countActiveTeamMembers,
  createFlowError,
  cacheTag,
} from '@flow/db';
import type { ActionResult } from '@flow/types';
import { getProTeamMemberLimit } from '@/lib/config/tier-config';
import { invalidateUserSessions } from '@flow/auth/server-admin';
import { logWorkspaceEvent } from '@/lib/workspace-audit';
import {
  dispatchSuspensionNotifications,
  type SuspendedMemberForNotification,
} from '@/lib/actions/billing/suspension-dispatch';

/** Reason recorded on suspended rows + audit events (machine-readable). */
const SUSPENSION_REASON = 'tier_downgrade_agency_to_pro';

/**
 * Result payload for a successful Agency→Pro downgrade. Distinct from the
 * 9-5b `DowngradeResult` (different shape — do not conflate).
 */
export interface AgencyToProDowngradeResult {
  /** Number of members kept active (<= proLimit). */
  preservedCount: number;
  /** IDs of the members flipped to status='suspended'. Empty when within limit. */
  suspendedMemberIds: string[];
  /** Owner-facing prompt shown in the banner (empty when nothing suspended). */
  upgradePrompt: string;
  /** Present when a non-fatal side-effect (session invalidation) partially failed. */
  warnings?: string[];
}

/**
 * Apply the Agency→Pro downgrade: suspend excess team members so the
 * workspace is compliant with the Pro limit the instant the webhook lands.
 *
 * Caller passes the webhook's `service_role` client. Idempotent — if the
 * workspace is already within the Pro limit, returns `suspendedMemberIds: []`.
 *
 * @example
 *   const result = await applyAgencyToProDowngrade({
 *     workspaceId: 'ws-1', supabase,
 *   });
 *   if (result.success) console.log(result.data.suspendedMemberIds);
 */
export async function applyAgencyToProDowngrade(input: {
  workspaceId: string;
  supabase?: SupabaseClient;
}): Promise<ActionResult<AgencyToProDowngradeResult>> {
  const supabase = input.supabase ?? createServiceClient();

  // PD1: Pro limit sourced from config (never hardcoded). Single helper so
  // the webhook and the billing UI share the same fallback (review M4).
  const proLimit = await getProTeamMemberLimit();

  const activeCount = await countActiveTeamMembers(supabase, input.workspaceId);
  const excess = Math.max(0, activeCount - proLimit);

  if (excess === 0) {
    // No-op — workspace already within Pro limit (covers EC1 + EC7 replay).
    return {
      success: true,
      data: {
        preservedCount: activeCount,
        suspendedMemberIds: [],
        upgradePrompt: '',
      },
    };
  }

  try {
    const { suspendedMemberIds, preservedCount } = await bulkSuspendMembers(
      supabase,
      input.workspaceId,
      proLimit,
      SUSPENSION_REASON,
    );

    // Best-effort session invalidation (Murat P0-1): per suspended member,
    // observable. A throw is caught + counted; partial failure does NOT roll
    // back the DB writes. While looping, also collect each member's email +
    // name for the AC5 notification dispatch (single pass, fewer round-trips).
    let sessionsConfirmed = 0;
    let partialFailure = false;
    const suspendedForNotify: SuspendedMemberForNotification[] = [];
    const suspendedAtIso = new Date().toISOString();
    for (const memberId of suspendedMemberIds) {
      // `memberId` here is the workspace_members.id; invalidateUserSessions
      // needs the auth user_id. Fetch user_id + the joined users(email, name)
      // in one query so we have everything for both session invalidation and
      // the AC5 notification dispatch.
      const { data: memberRow } = await supabase
        .from('workspace_members')
        .select('user_id, users(email, name)')
        .eq('id', memberId)
        .maybeSingle();
      const userId = (memberRow as { user_id?: string } | null)?.user_id;
      if (!userId) {
        partialFailure = true;
        continue;
      }
      const user = (
        memberRow as { users?: { email?: string; name?: string } | null } | null
      )?.users;
      const email = user?.email ?? '';
      const name = user?.name ?? null;
      if (email) {
        suspendedForNotify.push({
          userId,
          memberId,
          email,
          name,
          suspendedAt: suspendedAtIso,
        });
      }
      try {
        await invalidateUserSessions(userId);
        sessionsConfirmed += 1;
      } catch {
        partialFailure = true;
      }
    }

    // Audit log (best-effort — never fail the action on audit write failure).
    // Pass the webhook's service_role client: audit_log has SELECT-only RLS
    // (no INSERT policy for authenticated), so a user-scoped client would
    // silently no-op and the member_suspended row — which carries the
    // sessionsAttempted/sessionsConfirmed observability contract (Murat
    // P0-1) — would never land.
    try {
      await logWorkspaceEvent(
        {
          type: 'member_suspended',
          workspaceId: input.workspaceId,
          memberId: suspendedMemberIds.join(','),
          reason: SUSPENSION_REASON,
          triggeredBy: 'stripe-webhook',
          sessionsAttempted: suspendedMemberIds.length,
          sessionsConfirmed,
          timestamp: new Date().toISOString(),
        },
        supabase,
      );
    } catch {
      // Audit logging best-effort — do not fail the action.
    }

    revalidateTag(cacheTag('workspace_member', input.workspaceId));
    revalidateTag(cacheTag('workspace_client', input.workspaceId));

    // AC5 — notification dispatch (best-effort, log + continue on failure,
    // never roll back the suspension). Delegated to the extracted helper so
    // this handler stays under the 250-line file limit and the notification
    // concern is testable in isolation. `failed > 0` feeds the EC6 warnings
    // contract alongside the session-invalidation partial-failure signal.
    const { failed: notificationsFailed } =
      await dispatchSuspensionNotifications({
        supabase,
        workspaceId: input.workspaceId,
        suspendedMembers: suspendedForNotify,
      });
    if (notificationsFailed > 0) partialFailure = true;

    // Build the result. `warnings` is included ONLY when there was a partial
    // failure (exactOptionalPropertyTypes: an optional key with value
    // `undefined` is not assignable — the key must be absent, not present-and-undefined).
    const data: AgencyToProDowngradeResult = {
      preservedCount,
      suspendedMemberIds,
      upgradePrompt:
        suspendedMemberIds.length > 0
          ? `You have ${suspendedMemberIds.length} paused team member${suspendedMemberIds.length === 1 ? '' : 's'} from your Pro plan limit. Upgrade to Agency to restore their access.`
          : '',
    };
    if (partialFailure) {
      data.warnings = ['session_invalidation_partial'];
    }

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        `Agency→Pro downgrade suspend failed: ${err instanceof Error ? err.message : String(err)}`,
        'system',
      ),
    };
  }
}
