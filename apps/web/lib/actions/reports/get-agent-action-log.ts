'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import type { ActionResult, AgentRun } from '@flow/types';

interface ActionLogFilters {
  clientId?: string;
  periodStart?: string;
  periodEnd?: string;
}

export async function getAgentActionLogAction(
  filters: ActionLogFilters = {},
): Promise<ActionResult<AgentRun[]>> {
  const supabase = await getServerSupabase();
  let ctx;
  try {
    ctx = await requireTenantContext(supabase);
  } catch {
    return {
      success: false,
      error: createFlowError(401, 'AUTH_REQUIRED', 'Authentication required', 'auth'),
    };
  }

  let query = supabase
    .from('agent_runs')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false });

  if (filters.clientId) {
    query = query.eq('client_id', filters.clientId);
  }

  if (filters.periodStart) {
    query = query.gte('created_at', `${filters.periodStart}T00:00:00Z`);
  }

  if (filters.periodEnd) {
    const d = new Date(`${filters.periodEnd}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    const periodEndNext = d.toISOString().split('T')[0]!;
    query = query.lt('created_at', `${periodEndNext}T00:00:00Z`);
  }

  const { data, error } = await query;
  if (error) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to retrieve agent action logs', 'system'),
    };
  }

  const mapped: AgentRun[] = (data ?? []).map((row: any) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    agentId: row.agent_id,
    jobId: row.job_id,
    signalId: row.signal_id,
    actionType: row.action_type,
    clientId: row.client_id,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    input: row.input,
    output: row.output,
    error: row.error,
    trustTierAtExecution: row.trust_tier_at_execution,
    trustSnapshotId: row.trust_snapshot_id,
    correlationId: row.correlation_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return {
    success: true,
    data: mapped,
  };
}
