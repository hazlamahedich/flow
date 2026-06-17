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

/**
 * Alias of `getUserActiveAgentCount` for tier-limit enforcement (Story 9.4).
 *
 * RLS-safe (accepts a user-scoped SupabaseClient). The non-user-scoped
 * `getActiveAgentCount` (configurations.ts) uses `service_role` internally
 * and is FORBIDDEN in user-facing actions like `enforceTierLimit`
 * (project-context.md:150). This alias makes the contract explicit so
 * 9-5b and future code reference the user-scoped variant by name.
 */
export const countActiveAgents = getUserActiveAgentCount;

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
