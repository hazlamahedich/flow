import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentId, AgentRun, ApprovalQueueItem } from '@flow/types';
import { parseApprovalOutputWithRun } from '@flow/types';
import { z } from 'zod';

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

const agentRunRowSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  agent_id: z.string(),
  job_id: z.string(),
  signal_id: z.string().nullable().optional(),
  action_type: z.string(),
  client_id: z.string().nullable().optional(),
  idempotency_key: z.string().nullable().optional(),
  status: z.string(),
  input: z.record(z.string(), z.unknown()),
  output: z.record(z.string(), z.unknown()).nullable().optional(),
  error: z.record(z.string(), z.unknown()).nullable().optional(),
  trust_tier_at_execution: z.string().nullable().optional(),
  trust_snapshot_id: z.string().nullable().optional(),
  correlation_id: z.string(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  corrected_run_id: z.string().nullable().optional(),
  correction_depth: z.number().optional(),
  correction_issued: z.boolean().optional(),
  source: z.enum(['agent', 'human_correction']).optional(),
}).passthrough();

export function mapRun(raw: Record<string, unknown>): AgentRun {
  const parsed = agentRunRowSchema.parse(raw);
  return {
    id: parsed.id,
    workspaceId: parsed.workspace_id,
    agentId: parsed.agent_id as AgentId,
    jobId: parsed.job_id,
    signalId: parsed.signal_id ?? null,
    actionType: parsed.action_type,
    clientId: parsed.client_id ?? null,
    idempotencyKey: parsed.idempotency_key ?? null,
    status: parsed.status as AgentRun['status'],
    input: parsed.input,
    output: parsed.output ?? null,
    error: parsed.error ?? null,
    trustTierAtExecution: parsed.trust_tier_at_execution ?? null,
    trustSnapshotId: parsed.trust_snapshot_id ?? null,
    correlationId: parsed.correlation_id,
    startedAt: parsed.started_at ?? null,
    completedAt: parsed.completed_at ?? null,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
    correctedRunId: parsed.corrected_run_id ?? null,
    correctionDepth: parsed.correction_depth ?? 0,
    correctionIssued: parsed.correction_issued ?? false,
    source: parsed.source ?? 'agent',
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
    const aid = row.agent_id;
    breakdown[aid] = (breakdown[aid] ?? 0) + 1;
  }
  return breakdown;
}
