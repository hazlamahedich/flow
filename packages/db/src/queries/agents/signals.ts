import { createServiceClient } from '../../client';
import type { agentSignals } from '../../schema/agent-signals';

type NewSignal = typeof agentSignals.$inferInsert;

export async function insertSignal(signal: NewSignal) {
  const client = createServiceClient();
  const { data, error } = await client
    .from('agent_signals')
    .insert(signal)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSignalsByCorrelationId(
  correlationId: string,
  workspaceId: string,
) {
  const client = createServiceClient();
  const { data, error } = await client
    .from('agent_signals')
    .select('*')
    .eq('correlation_id', correlationId)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getSignalsByWorkspace(
  workspaceId: string,
  limit = 50,
  offset = 0,
) {
  const client = createServiceClient();
  const safeLimit = Math.min(limit, 200);
  const safeOffset = Math.max(offset, 0);
  const { data, error } = await client
    .from('agent_signals')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);
  if (error) throw error;
  return data;
}
