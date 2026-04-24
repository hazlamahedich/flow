import { createServiceClient } from '../../client';

interface TrustTransitionInsert {
  matrix_entry_id: string;
  workspace_id: string;
  from_level: 'supervised' | 'confirm' | 'auto';
  to_level: 'supervised' | 'confirm' | 'auto';
  trigger_type: string;
  trigger_reason: string;
  is_context_shift: boolean;
  snapshot: Record<string, unknown>;
  actor: string;
}

interface TrustTransitionDbRow extends TrustTransitionInsert {
  id: string;
  created_at: string;
}

export type { TrustTransitionDbRow, TrustTransitionInsert };

export async function insertTransition(
  entry: TrustTransitionInsert,
): Promise<TrustTransitionDbRow> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('trust_transitions')
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getTransitions(
  workspaceId: string,
  agentId?: string,
  limit?: number,
): Promise<TrustTransitionDbRow[]> {
  const client = createServiceClient();
  let query = client
    .from('trust_transitions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (agentId) {
    const { data, error } = await client
      .from('trust_matrix')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('agent_id', agentId);
    if (error) throw error;
    if (data.length === 0) {
      return [];
    }
    const ids = data.map((r: { id: string }) => r.id);
    query = query.in('matrix_entry_id', ids);
  }
  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
