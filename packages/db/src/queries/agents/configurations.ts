import { createServiceClient } from '../../client';
import type { agentConfigurations } from '../../schema/agent-configurations';
import type { AgentBackendStatus } from '@flow/types';

type AgentConfigurationRow = typeof agentConfigurations.$inferSelect;
type NewAgentConfiguration = typeof agentConfigurations.$inferInsert;

export class AgentTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
    public readonly expectedVersion: number,
    message: string,
  ) {
    super(message);
    this.name = 'AgentTransitionError';
  }
}

export async function getAgentConfigurations(
  workspaceId: string,
): Promise<AgentConfigurationRow[]> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('agent_configurations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('agent_id', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getActiveAgentCount(
  workspaceId: string,
): Promise<number> {
  const client = createServiceClient();
  const { count, error } = await client
    .from('agent_configurations')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');
  if (error) throw error;
  return count ?? 0;
}

export async function getAgentConfiguration(
  workspaceId: string,
  agentId: string,
): Promise<AgentConfigurationRow | null> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('agent_configurations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('agent_id', agentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function transitionAgentStatus(
  workspaceId: string,
  agentId: string,
  target: AgentBackendStatus,
  expectedVersion: number,
): Promise<AgentConfigurationRow> {
  const client = createServiceClient();

  const updates: Record<string, unknown> = {
    status: target,
    lifecycle_version: expectedVersion + 1,
  };

  if (target === 'active') {
    updates.activated_at = new Date().toISOString();
    updates.has_ever_been_activated = true;
  }
  if (target === 'inactive') {
    updates.deactivated_at = new Date().toISOString();
  }

  const { data, error } = await client
    .from('agent_configurations')
    .update(updates)
    .eq('workspace_id', workspaceId)
    .eq('agent_id', agentId)
    .eq('lifecycle_version', expectedVersion)
    .select()
    .single();

  if (error) {
    throw new AgentTransitionError(
      'unknown',
      target,
      expectedVersion,
      `CAS transition failed for ${agentId}: ${error.message}`,
    );
  }
  if (!data) {
    throw new AgentTransitionError(
      'unknown',
      target,
      expectedVersion,
      `No row updated — version mismatch or row not found for ${agentId} (expected v${expectedVersion})`,
    );
  }
  return data;
}

export async function updateAgentConfig(
  workspaceId: string,
  agentId: string,
  config: {
    schedule?: Record<string, unknown>;
    triggerConfig?: Record<string, unknown>;
    llmPreferences?: Record<string, unknown>;
  },
  expectedVersion: number,
): Promise<AgentConfigurationRow> {
  const client = createServiceClient();
  const updates: Record<string, unknown> = {
    lifecycle_version: expectedVersion + 1,
  };
  if (config.schedule !== undefined) updates.schedule = config.schedule;
  if (config.triggerConfig !== undefined) updates.trigger_config = config.triggerConfig;
  if (config.llmPreferences !== undefined) updates.llm_preferences = config.llmPreferences;

  const { data, error } = await client
    .from('agent_configurations')
    .update(updates)
    .eq('workspace_id', workspaceId)
    .eq('agent_id', agentId)
    .eq('lifecycle_version', expectedVersion)
    .select()
    .single();

  if (error) {
    throw new AgentTransitionError(
      'config-update',
      'config-update',
      expectedVersion,
      `CAS config update failed for ${agentId}: ${error.message}`,
    );
  }
  if (!data) {
    throw new AgentTransitionError(
      'config-update',
      'config-update',
      expectedVersion,
      `No row updated — version mismatch or row not found for ${agentId} (expected v${expectedVersion})`,
    );
  }
  return data;
}

export async function markSetupCompleted(
  workspaceId: string,
  agentId: string,
): Promise<AgentConfigurationRow> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('agent_configurations')
    .update({ setup_completed: true })
    .eq('workspace_id', workspaceId)
    .eq('agent_id', agentId)
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error(`Agent configuration not found: ${agentId}`);
  return data;
}

export async function updateIntegrationHealth(
  workspaceId: string,
  agentId: string,
  health: 'healthy' | 'degraded' | 'disconnected',
): Promise<AgentConfigurationRow> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('agent_configurations')
    .update({ integration_health: health })
    .eq('workspace_id', workspaceId)
    .eq('agent_id', agentId)
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error(`Agent configuration not found: ${agentId}`);
  return data;
}

export async function upsertAgentConfiguration(
  row: NewAgentConfiguration,
): Promise<AgentConfigurationRow> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('agent_configurations')
    .upsert(row, { onConflict: 'workspace_id,agent_id', ignoreDuplicates: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}
