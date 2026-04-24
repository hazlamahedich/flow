import type { agentConfigurations } from '../../schema/agent-configurations';

type AgentConfigurationRow = typeof agentConfigurations.$inferSelect;
type ServerClient = ReturnType<typeof import('../../client').createServerClient>;

export async function getUserAgentConfigurations(
  client: ServerClient,
  workspaceId: string,
): Promise<AgentConfigurationRow[]> {
  const { data, error } = await client
    .from('agent_configurations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('agent_id', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getUserActiveAgentCount(
  client: ServerClient,
  workspaceId: string,
): Promise<number> {
  const { count, error } = await client
    .from('agent_configurations')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');
  if (error) throw error;
  return count ?? 0;
}

export async function getUserAgentConfiguration(
  client: ServerClient,
  workspaceId: string,
  agentId: string,
): Promise<AgentConfigurationRow | null> {
  const { data, error } = await client
    .from('agent_configurations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('agent_id', agentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
