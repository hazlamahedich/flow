/**
 * enforceTierLimit — tier-limit enforcement helper (Story 9.4, AC1/AC2, FR56).
 *
 * NOT a Server Action file itself. This module is imported BY Server Actions
 * (`create-client.ts`, `invite-member.ts`, `agent-config/queries.ts`) to gate
 * resource creation. Marking it `'use server'` would break that import shape.
 *
 * Architecture compliance:
 *  - User-facing path → `getServerSupabase()` (RLS-enforced). `service_role`
 *    is forbidden (project-context.md:150).
 *  - Tier source is `workspaces.subscription_tier` (Epic 9 column), NEVER
 *    the legacy `workspaces.settings.tier` JSONB field.
 *  - `null` limit (Agency) → `Number.MAX_SAFE_INTEGER` via `getTierLimits`
 *    so `checkTierLimit` needs no unlimited special-case (AC1).
 *  - Pure decision lives in `@flow/shared` (`checkTierLimit`) so 9-5b and
 *    the UI's UsageMeter can reuse it.
 *  - Status-independent (EC10): `past_due` Pro workspaces keep Pro limits.
 *    Status-based pausing is 9-5b's concern.
 *  - TOCTOU (EC9): read-count → check → caller-inserts is a known race.
 *    Accepted for MVP; strict DB enforcement is a Deferred Item.
 */
import { getServerSupabase } from '@/lib/supabase-server';
import { getTierConfig } from '@/lib/config/tier-config';
import { checkTierLimit } from '@flow/shared';
import {
  countActiveClients,
  countActiveTeamMembers,
  countActiveAgents,
} from '@flow/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubscriptionTier } from '@flow/types';
import { z } from 'zod';

/** Resources gated by tier limits. */
export type TieredResource = 'clients' | 'team_members' | 'agents';

/**
 * Normalized tier limit — `null` (Agency) is converted to
 * `Number.MAX_SAFE_INTEGER` so downstream pure check logic never has to
 * special-case unlimited.
 */
export interface TierLimit {
  maxClients: number;
  maxTeamMembers: number;
  maxAgents: number;
}

/** Zod schema for the normalized TierLimit shape (AC1). */
export const tierLimitSchema = z.object({
  maxClients: z.number(),
  maxTeamMembers: z.number(),
  maxAgents: z.number(),
});

const UNLIMITED = Number.MAX_SAFE_INTEGER;

/**
 * Resolve a tier's limits, normalizing `null` → `MAX_SAFE_INTEGER`.
 *
 * Reads exclusively via `getTierConfig().tierLimits[tier]` — the canonical
 * config reader (9-3a). Never queries `app_config` directly.
 */
export async function getTierLimits(tier: SubscriptionTier): Promise<TierLimit> {
  const config = await getTierConfig();
  const raw = config.tierLimits[tier];
  return {
    maxClients: raw.maxClients ?? UNLIMITED,
    maxTeamMembers: raw.maxTeamMembers ?? UNLIMITED,
    maxAgents: raw.maxAgents ?? UNLIMITED,
  };
}

export interface EnforceTierLimitInput {
  workspaceId: string;
  resource: TieredResource;
  /** How many resources the caller intends to add (default 1). */
  delta?: number;
}

/** Reason codes for denied tier-limit checks. */
export type TierLimitDenialReason = 'workspace_not_found' | 'limit_exceeded';

export interface TierLimitResult {
  allowed: boolean;
  warning?: string | undefined;
  limit?: number | undefined;
  current?: number | undefined;
  tier?: SubscriptionTier | undefined;
  reason?: TierLimitDenialReason | undefined;
}

interface WorkspaceTierRow {
  subscription_tier: SubscriptionTier;
  subscription_status: string;
}

async function fetchWorkspaceTier(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceTierRow | null> {
  const { data } = await supabase
    .from('workspaces')
    .select('subscription_tier, subscription_status')
    .eq('id', workspaceId)
    .maybeSingle();
  if (!data) return null;
  return data as unknown as WorkspaceTierRow;
}

/**
 * Count the workspace's current usage of `resource` via RLS-safe helpers
 * (never `service_role`). All three helpers accept the user-scoped client
 * and apply RLS — `countActiveAgents` is the user-scoped alias of
 * `getUserActiveAgentCount`; the `service_role` `getActiveAgentCount` is
 * forbidden here.
 */
async function countUsage(
  supabase: SupabaseClient,
  workspaceId: string,
  resource: TieredResource,
): Promise<number> {
  switch (resource) {
    case 'clients':
      return countActiveClients(supabase, workspaceId);
    case 'team_members':
      return countActiveTeamMembers(supabase, workspaceId);
    case 'agents':
      return countActiveAgents(supabase, workspaceId);
  }
}

function limitFor(tier: TierLimit, resource: TieredResource): number {
  switch (resource) {
    case 'clients':
      return tier.maxClients;
    case 'team_members':
      return tier.maxTeamMembers;
    case 'agents':
      return tier.maxAgents;
  }
}

/**
 * Enforce a tier limit for the given workspace + resource.
 *
 * Callers MUST call this AFTER the tenant/role check and BEFORE the insert.
 * Map `{ allowed: false }` to `createFlowError(403, 'TIER_LIMIT_EXCEEDED', ...)`.
 *
 * Returns `{ allowed: true }` always for Agency tier (EC1) — the normalized
 * MAX_SAFE_INTEGER limit makes that automatic via `checkTierLimit`.
 */
export async function enforceTierLimit(
  input: EnforceTierLimitInput,
): Promise<TierLimitResult> {
  const supabase = await getServerSupabase();
  const workspace = await fetchWorkspaceTier(supabase, input.workspaceId);
  if (!workspace) {
    // RLS denied the read, or the row is gone. Fail closed.
    return { allowed: false, reason: 'workspace_not_found' };
  }

  const limits = await getTierLimits(workspace.subscription_tier);
  const limit = limitFor(limits, input.resource);
  const current = await countUsage(supabase, input.workspaceId, input.resource);

  const decision = checkTierLimit({
    current,
    adding: input.delta ?? 1,
    limit,
  });

  return {
    allowed: decision.allowed,
    warning: decision.warning,
    limit,
    current,
    tier: workspace.subscription_tier,
    reason: decision.allowed ? undefined : 'limit_exceeded',
  };
}
