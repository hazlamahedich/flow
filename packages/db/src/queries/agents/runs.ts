import { createServiceClient } from '../../client';
import type { agentRuns } from '../../schema/agent-runs';
import { VALID_RUN_TRANSITIONS } from '@flow/types';
import type { AgentRunStatus } from '@flow/types';

type NewRun = typeof agentRuns.$inferInsert;

interface RunStatusUpdate {
  output?: Record<string, unknown>;
  error?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
}

export async function insertRun(run: NewRun) {
  const client = createServiceClient();
  const { data, error } = await client
    .from('agent_runs')
    .insert(run)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRunStatus(
  runId: string,
  newStatus: AgentRunStatus,
  update: RunStatusUpdate,
) {
  const client = createServiceClient();
  const { data: current, error: selectError } = await client
    .from('agent_runs')
    .select('status')
    .eq('id', runId)
    .single();
  if (selectError) throw selectError;
  if (!current) throw new Error(`Run ${runId} not found`);
  const allowed = VALID_RUN_TRANSITIONS[current.status as AgentRunStatus];
  if (!allowed || !(allowed as readonly string[]).includes(newStatus)) {
    throw new Error(`Invalid state transition: ${current.status} → ${newStatus}`);
  }
  const { data, error } = await client
    .from('agent_runs')
    .update({ ...update, status: newStatus })
    .eq('id', runId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getRunsByWorkspace(
  workspaceId: string,
  filters?: { agentId?: string; status?: string; limit?: number; offset?: number },
) {
  const client = createServiceClient();
  let query = client
    .from('agent_runs')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (filters?.agentId) {
    query = query.eq('agent_id', filters.agentId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const limit = Math.min(filters?.limit ?? 50, 200);
  const offset = Math.max(filters?.offset ?? 0, 0);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function getRunByJobId(
  jobId: string,
  workspaceId: string,
) {
  const client = createServiceClient();
  const { data, error } = await client
    .from('agent_runs')
    .select('*')
    .eq('job_id', jobId)
    .eq('workspace_id', workspaceId)
    .single();
  if (error) throw error;
  return data;
}
