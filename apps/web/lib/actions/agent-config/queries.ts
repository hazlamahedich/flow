import {
  getAgentConfiguration,
  upsertAgentConfiguration,
  transitionAgentStatus,
  getUserAgentConfigurations,
  createFlowError,
} from '@flow/db';
import type { AgentBackendStatus, AgentId } from '@flow/types';
import { isValidTransition } from '@flow/shared';
import { enforceTierLimit } from '@/lib/actions/billing/enforce-tier-limit';

export async function listConfigurations(
  client: ReturnType<typeof import('@flow/db').createServerClient>,
  workspaceId: string,
) {
  return getUserAgentConfigurations(client, workspaceId);
}

export async function ensureConfiguration(
  workspaceId: string,
  agentId: string,
) {
  const existing = await getAgentConfiguration(workspaceId, agentId);
  if (existing) return existing;
  return upsertAgentConfiguration({
    workspaceId,
    agentId: agentId as AgentId,
    status: 'inactive' as AgentBackendStatus,
  });
}

export async function activateWithChecks(
  workspaceId: string,
  agentId: string,
  expectedVersion: number,
) {
  // Tier limit enforcement (Story 9.4 AC3 — FR56). Counts active
  // agent_configurations (status='active'); Agency tier is unlimited.
  // Runs BEFORE the config lookup to fail fast on blocked workspaces.
  const tierCheck = await enforceTierLimit({ workspaceId, resource: 'agents' });
  if (!tierCheck.allowed) {
    const limitText = tierCheck.limit != null ? `(${tierCheck.limit})` : '';
    return {
      success: false as const,
      error: createFlowError(
        403,
        'TIER_LIMIT_EXCEEDED',
        `You've reached the active-agent limit ${limitText} for your plan. Upgrade to activate more.`,
        'validation',
        {
          resource: 'agents',
          current: tierCheck.current,
          limit: tierCheck.limit,
          tier: tierCheck.tier,
          reason: tierCheck.reason,
        },
      ),
    };
  }

  const config = await getAgentConfiguration(workspaceId, agentId);
  if (!config) throw new Error('Agent configuration not found');

  const row = config as unknown as Record<string, unknown>;
  if (!row.setup_completed) {
    return {
      success: false as const,
      error: {
        status: 400,
        code: 'VALIDATION_ERROR' as const,
        message: 'Agent setup must be completed before activation',
        category: 'validation' as const,
      },
    };
  }

  const currentStatus = row.status as AgentBackendStatus;
  if (!isValidTransition(currentStatus, 'activating')) {
    return {
      success: false as const,
      error: {
        status: 409,
        code: 'CONFLICT' as const,
        message: `Cannot activate agent in ${currentStatus} state`,
        category: 'validation' as const,
      },
    };
  }

  const activating = await transitionAgentStatus(
    workspaceId,
    agentId,
    'activating',
    expectedVersion,
  );
  const activatingRow = activating as unknown as Record<string, unknown>;
  const activatingVersion = (activatingRow.lifecycle_version ??
    activatingRow.lifecycleVersion) as number;

  const activeResult = await transitionAgentStatus(
    workspaceId,
    agentId,
    'active',
    activatingVersion,
  );
  return { success: true as const, data: activeResult };
}
