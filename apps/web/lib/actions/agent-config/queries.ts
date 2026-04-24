import {
  getAgentConfiguration,
  upsertAgentConfiguration,
  transitionAgentStatus,
  getUserAgentConfigurations,
} from '@flow/db';
import type { AgentBackendStatus, AgentId } from '@flow/types';
import { isValidTransition } from '@flow/shared';

export async function listConfigurations(
  client: ReturnType<typeof import('@flow/db').createServerClient>,
  workspaceId: string,
) {
  return getUserAgentConfigurations(client, workspaceId);
}

export async function ensureConfiguration(workspaceId: string, agentId: string) {
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
  const config = await getAgentConfiguration(workspaceId, agentId);
  if (!config) throw new Error('Agent configuration not found');

  const row = config as unknown as Record<string, unknown>;
  if (!row.setup_completed) {
    return { success: false as const, error: { status: 400, code: 'VALIDATION_ERROR' as const, message: 'Agent setup must be completed before activation', category: 'validation' as const } };
  }

  const currentStatus = row.status as AgentBackendStatus;
  if (!isValidTransition(currentStatus, 'activating')) {
    return { success: false as const, error: { status: 409, code: 'CONFLICT' as const, message: `Cannot activate agent in ${currentStatus} state`, category: 'validation' as const } };
  }

  const activating = await transitionAgentStatus(workspaceId, agentId, 'activating', expectedVersion);
  const activatingRow = activating as unknown as Record<string, unknown>;
  const activatingVersion = (activatingRow.lifecycle_version ?? activatingRow.lifecycleVersion) as number;

  const activeResult = await transitionAgentStatus(workspaceId, agentId, 'active', activatingVersion);
  return { success: true as const, data: activeResult };
}
