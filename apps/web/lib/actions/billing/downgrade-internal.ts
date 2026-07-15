/**
 * Downgrade-on-tier-change internal function (Story 9.5b AC3 — FR57).
 *
 * `applyDowngradeOnTierChange` is an INTERNAL function (NOT a Server Action)
 * invoked by the Stripe `customer.subscription.updated` webhook handler
 * (apps/web/lib/stripe/handlers/subscription-updated.ts) AFTER the
 * tier-flip RPC `upsert_workspace_subscription`. It archives excess clients
 * (MRU-LAST) so the workspace stays within the Free tier limit.
 *
 * Trigger source: webhook-bound. The archive runs immediately after the tier
 * flip in the same webhook request, which is the earliest safe point and
 * avoids a separate Server Action call. True atomicity is provided by the
 * caller wrapping both operations in a DB transaction when possible; this
 * helper accepts an injected `service_role` client so the caller can share
 * a connection/transaction context. The tier_drift reconciliation in
 * `reconcileSubscriptions()` is the safety net for missed webhooks (T4.5).
 *
 * Returns `{ success, data: { preservedCount, archivedClientIds, upgradePrompt } }`
 * on success, or `{ success: false, error: FlowError }` for EC2/EC3/EC4/EC12.
 *
 * Never deletes data (EC7). Archived clients are read-only via RLS (T4.6
 * migration) + app defence-in-depth (T4.7).
 *
 * NOTE: This module is imported by the webhook handler and runs in
 * `service_role` context. It does NOT call `requireTenantContext`.
 */
import { z } from 'zod';
import { revalidateTag } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createServiceClient,
  bulkArchiveClients,
  countActiveClients,
  createFlowError,
  cacheTag,
} from '@flow/db';
import { downgradeSchema, type ActionResult } from '@flow/types';
import { getTierConfig } from '@/lib/config/tier-config';

/**
 * Result payload for a successful downgrade. Consumed by `DowngradeBanner`
 * (T5.1) and the webhook audit log.
 */
export interface DowngradeResult {
  preservedCount: number;
  archivedClientIds: string[];
  upgradePrompt: string;
}

/**
 * Free tier's `maxClients` from `getTierConfig()`. Falls back to the PRD
 * canonical value of 2 if config is missing (defensive — config IS seeded).
 */
import { PRD_FREE_MAX_CLIENTS } from '@flow/shared';

async function resolveFreeMaxClients(): Promise<number> {
  try {
    const config = await getTierConfig();
    return config.tierLimits.free.maxClients ?? PRD_FREE_MAX_CLIENTS;
  } catch {
    return PRD_FREE_MAX_CLIENTS;
  }
}

/**
 * Validate the downgrade input. Mirrors `downgradeSchema` but with explicit
 * branching for the EC2/EC3 (same-tier) and EC4 (upgrade-direction) cases.
 *
 * Returns null on success, or a FlowError for the caller to return.
 */
function validateDowngradeInput(
  input: unknown,
): | { ok: true; data: { fromTier: 'pro' | 'agency'; toTier: 'free' } }
   | { ok: false; error: ReturnType<typeof createFlowError> } {
  const parsed = downgradeSchema.safeParse(input);
  if (!parsed.success) {
    // Distinguish EC2/EC3 (INVALID_STATE) from EC4 (VALIDATION_ERROR):
    //  - EC2/EC3: `fromTier` is 'free' or absent (cannot downgrade FROM Free)
    //  - EC4: `toTier` is 'pro' or 'agency' (upgrade-direction, not a downgrade)
    //  - Other shape errors → generic VALIDATION_ERROR
    const fromTierErrors = parsed.error.issues.filter((i) => i.path.includes('fromTier'));
    const toTierUpgradeErrors = parsed.error.issues.filter(
      (i) => i.code === 'invalid_enum_value' && i.path.includes('toTier') && (i.received === 'pro' || i.received === 'agency'),
    );

    if (fromTierErrors.length > 0 && toTierUpgradeErrors.length === 0) {
      // EC2/EC3 — downgrade-from-Free or same-tier
      return {
        ok: false,
        error: createFlowError(409, 'INVALID_STATE', 'Cannot downgrade from Free tier.', 'validation'),
      };
    }
    if (toTierUpgradeErrors.length > 0) {
      // EC4 — upgrade-direction
      return {
        ok: false,
        error: createFlowError(400, 'VALIDATION_ERROR', 'Target tier must be Free for downgrade.', 'validation'),
      };
    }
    return {
      ok: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid downgrade input.', 'validation'),
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Reject the downgrade when the workspace's `subscription_status` is not
 * `active` (EC12 — suspended/past_due/cancelled workspaces cannot downgrade;
 * reactivate first).
 */
async function rejectIfStatusNotActive(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<ReturnType<typeof createFlowError> | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('subscription_status')
    .eq('id', workspaceId)
    .maybeSingle();
  if (error || !data) {
    return createFlowError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found.', 'validation');
  }
  const status = (data as { subscription_status: string }).subscription_status;
  // D2 decision: downgrade is allowed from active, free, past_due, or cancelled.
  // Only suspended and deleted workspaces must reactivate first (EC12 / terminal).
  if (status === 'suspended' || status === 'deleted') {
    return createFlowError(409, 'INVALID_STATE', `Cannot downgrade while subscription_status=${status}. Reactivate first.`, 'validation');
  }
  return null;
}

/**
 * Apply the downgrade: archive excess clients MRU-LAST.
 *
 * Caller passes the webhook's `service_role` client. Idempotent — if the
 * workspace is already within the Free limit, returns `archivedClientIds: []`.
 *
 * @example
 *   const result = await applyDowngradeOnTierChange({
 *     workspaceId: 'ws-1', fromTier: 'pro', toTier: 'free',
 *   });
 *   if (result.success) console.log(result.data.archivedClientIds);
 */
export async function applyDowngradeOnTierChange(
  input: {
    workspaceId: string;
    fromTier: 'pro' | 'agency';
    toTier: 'free';
    supabase?: SupabaseClient;
  },
): Promise<ActionResult<DowngradeResult>> {
  const validation = validateDowngradeInput(input);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  const supabase = input.supabase ?? createServiceClient();

  const statusError = await rejectIfStatusNotActive(supabase, input.workspaceId);
  if (statusError) {
    return { success: false, error: statusError };
  }

  const freeMaxClients = await resolveFreeMaxClients();
  const activeCount = await countActiveClients(supabase, input.workspaceId);
  const excess = Math.max(0, activeCount - freeMaxClients);

  if (excess === 0) {
    // No-op — workspace already within Free limit.
    return {
      success: true,
      data: {
        preservedCount: activeCount,
        archivedClientIds: [],
        upgradePrompt: '',
      },
    };
  }

  try {
    const { archivedClientIds, preservedCount } = await bulkArchiveClients(
      supabase,
      input.workspaceId,
      freeMaxClients,
    );

    revalidateTag(cacheTag('workspace', input.workspaceId));

    return {
      success: true,
      data: {
        preservedCount,
        archivedClientIds,
        upgradePrompt: archivedClientIds.length > 0
          ? `You have ${archivedClientIds.length} archived clients from your previous plan. Upgrade to Pro to edit all clients.`
          : '',
      },
    };
  } catch (err) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        `Downgrade archive failed: ${err instanceof Error ? err.message : String(err)}`,
        'system',
      ),
    };
  }
}

/**
 * Schema re-export for callers/tests that want to verify shape without
 * importing from `@flow/types` separately.
 */
export { downgradeSchema };
export type DowngradeSchema = z.infer<typeof downgradeSchema>;
