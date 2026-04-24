import { createServiceClient } from '../../client';

interface TrustPreconditionDbRow {
  id: string;
  workspace_id: string;
  agent_id: string;
  action_type: string;
  condition_key: string;
  condition_expr: string;
  is_active: boolean;
  created_at: string;
}

export type { TrustPreconditionDbRow };

export async function getPreconditions(
  workspaceId: string,
  agentId: string,
  actionType: string,
): Promise<TrustPreconditionDbRow[]> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('trust_preconditions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('agent_id', agentId)
    .eq('action_type', actionType)
    .eq('is_active', true);
  if (error) throw error;
  return data;
}

export async function upsertPrecondition(
  workspaceId: string,
  agentId: string,
  actionType: string,
  key: string,
  expr: string,
): Promise<TrustPreconditionDbRow> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('trust_preconditions')
    .upsert(
      {
        workspace_id: workspaceId,
        agent_id: agentId,
        action_type: actionType,
        condition_key: key,
        condition_expr: expr,
      },
      { onConflict: 'workspace_id,agent_id,action_type,condition_key' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePrecondition(id: string, workspaceId: string): Promise<void> {
  const client = createServiceClient();
  const { error } = await client
    .from('trust_preconditions')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);
  if (error) throw error;
}
