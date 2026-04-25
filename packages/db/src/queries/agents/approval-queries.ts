import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentId, AgentRun, ApprovalQueueItem } from '@flow/types';
import { parseApprovalOutputWithRun } from '@flow/types';

interface PendingApprovalsOptions {
  limit?: number;
  cursor?: string;
}

interface PendingApprovalsResult {
  items: ApprovalQueueItem[];
  nextCursor: string | null;
  totalCount: number;
  agentBreakdown: Record<string, number>;
  trustStaleIds: Set<string>;
}

function mapRun(raw: Record<string, unknown>): AgentRun {
  return {
    id: raw.id as string,
    workspaceId: raw.workspace_id as string,
    agentId: raw.agent_id as AgentId,
    jobId: raw.job_id as string,
    signalId: (raw.signal_id as string | null) ?? null,
    actionType: raw.action_type as string,
    clientId: (raw.client_id as string | null) ?? null,
    idempotencyKey: (raw.idempotency_key as string | null) ?? null,
    status: raw.status as AgentRun['status'],
    input: raw.input as Record<string, unknown>,
    output: (raw.output as Record<string, unknown> | null) ?? null,
    error: (raw.error as Record<string, unknown> | null) ?? null,
    trustTierAtExecution: (raw.trust_tier_at_execution as string | null) ?? null,
    trustSnapshotId: (raw.trust_snapshot_id as string | null) ?? null,
    correlationId: raw.correlation_id as string,
    startedAt: (raw.started_at as string | null) ?? null,
    completedAt: (raw.completed_at as string | null) ?? null,
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

export async function getPendingApprovals(
  client: SupabaseClient,
  workspaceId: string,
  options: PendingApprovalsOptions = {},
): Promise<PendingApprovalsResult> {
  const limit = Math.min(options.limit ?? 50, 50);

  let query = client
    .from('agent_runs')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .eq('status', 'waiting_approval')
    .order('created_at', { ascending: true });

  if (options.cursor) {
    query = query.gt('created_at', options.cursor);
  }

  const { data, count, error } = await query.limit(limit + 1);
  if (error) throw error;

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  const approvalItems: ApprovalQueueItem[] = [];
  const breakdown: Record<string, number> = {};
  const trustStaleIds = new Set<string>();

  for (const raw of items) {
    const run = mapRun(raw);
    const item = parseApprovalOutputWithRun(run.output, run);
    if (item) {
      approvalItems.push(item);
      const aid = run.agentId;
      breakdown[aid] = (breakdown[aid] ?? 0) + 1;
    }
  }

  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? (lastItem.created_at as string) : null;

  return {
    items: approvalItems,
    nextCursor,
    totalCount: count ?? approvalItems.length,
    agentBreakdown: breakdown,
    trustStaleIds,
  };
}

export async function getPendingApprovalCount(
  client: SupabaseClient,
  workspaceId: string,
): Promise<number> {
  const { count, error } = await client
    .from('agent_runs')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'waiting_approval');
  if (error) throw error;
  return count ?? 0;
}

export async function getAgentBreakdown(
  client: SupabaseClient,
  workspaceId: string,
): Promise<Record<string, number>> {
  const { data, error } = await client
    .from('agent_runs')
    .select('agent_id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'waiting_approval');
  if (error) throw error;

  const breakdown: Record<string, number> = {};
  for (const row of data ?? []) {
    const aid = row.agent_id as string;
    breakdown[aid] = (breakdown[aid] ?? 0) + 1;
  }
  return breakdown;
}
