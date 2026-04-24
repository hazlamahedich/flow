import {
  transitionAgentStatus,
  getAgentConfiguration,
  createServiceClient,
} from '@flow/db';
import type { AgentBackendStatus } from '@flow/types';

export interface AffectedRun {
  runId: string;
  status: string;
  outcome: 'draining' | 'cancelled';
}

export interface DeactivationResult {
  affectedRuns: AffectedRun[];
}

const DRAINABLE_STATUSES = ['running', 'waiting_approval', 'queued'] as const;
const CANCEL_STATUSES = ['waiting_approval', 'queued'] as const;

export async function beginDrain(
  workspaceId: string,
  agentId: string,
  expectedVersion: number,
): Promise<DeactivationResult> {
  const config = await getAgentConfiguration(workspaceId, agentId);
  if (!config) {
    throw new Error(`Agent configuration not found: ${agentId}`);
  }

  const currentStatus = config.status as AgentBackendStatus;
  if (currentStatus !== 'active') {
    throw new Error(`Cannot drain agent in ${currentStatus} state`);
  }

  await transitionAgentStatus(workspaceId, agentId, 'draining', expectedVersion);

  const client = createServiceClient();
  const { data: runs, error: fetchError } = await client
    .from('agent_runs')
    .select('id, status')
    .eq('workspace_id', workspaceId)
    .eq('agent_id', agentId)
    .in('status', DRAINABLE_STATUSES);

  if (fetchError) throw fetchError;

  const affectedRuns: AffectedRun[] = (runs ?? []).map((run) => ({
    runId: run.id,
    status: run.status,
    outcome: run.status === 'running' ? 'draining' as const : 'cancelled' as const,
  }));

  const cancelIds = (runs ?? [])
    .filter((run) => CANCEL_STATUSES.includes(run.status))
    .map((run) => run.id);

  if (cancelIds.length > 0) {
    const { error: cancelError } = await client
      .from('agent_runs')
      .update({ status: 'cancelled' })
      .in('id', cancelIds);
    if (cancelError) throw cancelError;
  }

  const runningCount = affectedRuns.filter((r) => r.outcome === 'draining').length;
  if (runningCount === 0) {
    const updatedConfig = await getAgentConfiguration(workspaceId, agentId);
    if (!updatedConfig) throw new Error('Agent configuration lost during drain');
    const currentVersion = (updatedConfig as Record<string, unknown>).lifecycle_version as number;
    await transitionAgentStatus(workspaceId, agentId, 'inactive', currentVersion);
  }

  return { affectedRuns };
}

export async function completeDrain(
  workspaceId: string,
  agentId: string,
): Promise<void> {
  const config = await getAgentConfiguration(workspaceId, agentId);
  if (!config) {
    throw new Error(`Agent configuration not found: ${agentId}`);
  }

  const currentStatus = config.status as AgentBackendStatus;
  if (currentStatus !== 'draining') {
    throw new Error(`Agent is not in draining state: ${currentStatus}`);
  }

  const client = createServiceClient();
  const { count, error } = await client
    .from('agent_runs')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('agent_id', agentId)
    .eq('status', 'running');

  if (error) throw error;
  if (count && count > 0) {
    throw new Error(`Cannot complete drain: ${count} runs still in progress`);
  }

  const currentVersion = (config as Record<string, unknown>).lifecycle_version as number;
  await transitionAgentStatus(workspaceId, agentId, 'inactive', currentVersion);
}
