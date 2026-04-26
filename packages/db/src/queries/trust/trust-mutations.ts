import { createServiceClient } from '../../client';

interface UnacknowledgedRegression {
  id: string;
  matrix_entry_id: string;
  trigger_type: string;
  trigger_reason: string;
  from_level: string;
  to_level: string;
  trust_matrix: Array<{ agent_id: string; version: number }>;
}

export type { UnacknowledgedRegression };

export async function getUnacknowledgedRegressions(
  workspaceId: string,
): Promise<UnacknowledgedRegression[]> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('trust_transitions')
    .select(
      'id, matrix_entry_id, trigger_type, trigger_reason, from_level, to_level, trust_matrix(agent_id, version)',
    )
    .eq('workspace_id', workspaceId)
    .in('trigger_type', ['soft_violation', 'hard_violation'])
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data as UnacknowledgedRegression[];
}

export async function acknowledgeTransition(
  workspaceId: string,
  transitionId: string,
): Promise<void> {
  const client = createServiceClient();
  const { error } = await client
    .from('trust_transitions')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('id', transitionId)
    .eq('workspace_id', workspaceId)
    .is('acknowledged_at', null);
  if (error) throw error;
}

export async function upsertTrustProfile(): Promise<void> {
}

export async function recordMilestone(
  workspaceId: string,
  agentId: string,
  milestoneType: string,
): Promise<{ id: string }> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('trust_milestones')
    .insert({
      workspace_id: workspaceId,
      agent_id: agentId,
      milestone_type: milestoneType,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function insertTrustHistory(): Promise<void> {
}
