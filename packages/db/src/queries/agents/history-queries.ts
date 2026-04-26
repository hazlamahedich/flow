import { createServiceClient } from '../../client';
import { mapRun } from './approval-queries';
import { z } from 'zod';
import type {
  ActionHistoryFilters,
  ActionHistoryRow,
  CoordinationGroup,
  CorrectionInfo,
  FeedbackRow,
} from './history-types';

const feedbackRowSchema = z.object({
  id: z.string(),
  sentiment: z.enum(['positive', 'negative']),
  note: z.string().nullable().optional(),
  created_at: z.string(),
}).passthrough();

function mapFeedback(raw: Record<string, unknown> | null): FeedbackRow | null {
  if (!raw) return null;
  const parsed = feedbackRowSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    id: parsed.data.id,
    sentiment: parsed.data.sentiment,
    note: parsed.data.note ?? null,
    createdAt: parsed.data.created_at,
  };
}

const PAGE_SIZE = 25;

export async function getActionHistory(
  workspaceId: string,
  userId: string,
  filters: ActionHistoryFilters = {},
): Promise<{ data: ActionHistoryRow[]; total: number }> {
  const client = createServiceClient();
  const page = Math.max(filters.page ?? 1, 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = client
    .from('agent_runs')
    .select('*, feedback:agent_feedback!left(id, sentiment, note, created_at, user_id)', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (filters.agentId) query = query.eq('agent_id', filters.agentId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters.dateTo) {
    const inclusive = filters.dateTo.includes('T') ? filters.dateTo : filters.dateTo + 'T23:59:59.999Z';
    query = query.lte('created_at', inclusive);
  }
  if (filters.clientId) query = query.eq('client_id', filters.clientId);

  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  const rows: ActionHistoryRow[] = (data ?? []).map((row) => {
    const raw = row as Record<string, unknown>;
    const rawFeedback = raw.feedback as Array<Record<string, unknown>> | Record<string, unknown> | null;
    let userFeedback: FeedbackRow | null = null;
    if (Array.isArray(rawFeedback)) {
      const match = rawFeedback.find((f) => f.user_id === userId);
      userFeedback = match ? mapFeedback(match) : null;
    } else if (rawFeedback && !Array.isArray(rawFeedback)) {
      userFeedback = (rawFeedback as Record<string, unknown>).user_id === userId ? mapFeedback(rawFeedback) : null;
    }
    return {
      ...mapRun(raw),
      feedback: userFeedback,
    };
  });

  return { data: rows, total: count ?? 0 };
}

export async function getCoordinationGroups(
  workspaceId: string,
  filters: Omit<ActionHistoryFilters, 'page'> = {},
  limit = 50,
): Promise<CoordinationGroup[]> {
  const client = createServiceClient();

  let runQuery = client
    .from('agent_runs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .not('correlation_id', 'is', null)
    .order('created_at', { ascending: true });

  if (filters.agentId) runQuery = runQuery.eq('agent_id', filters.agentId);
  if (filters.status) runQuery = runQuery.eq('status', filters.status);
  if (filters.dateFrom) runQuery = runQuery.gte('created_at', filters.dateFrom);
  if (filters.dateTo) runQuery = runQuery.lte('created_at', filters.dateTo);

  const { data: runs, error: runsError } = await runQuery.limit(limit * 5);
  if (runsError) throw runsError;

  const correlationMap = new Map<string, ActionHistoryRow[]>();
  for (const raw of runs ?? []) {
    const run = mapRun(raw as Record<string, unknown>);
    const cid = run.correlationId;
    if (!correlationMap.has(cid)) correlationMap.set(cid, []);
    correlationMap.get(cid)!.push({ ...run, feedback: null });
  }

  const groups: CoordinationGroup[] = [];
  const seen = new Set<string>();
  const eligibleCids: string[] = [];
  const eligibleRuns = new Map<string, ActionHistoryRow[]>();
  for (const [correlationId, groupRuns] of correlationMap) {
    if (seen.has(correlationId) || groupRuns.length < 2) continue;
    seen.add(correlationId);
    if (eligibleCids.length >= limit) break;
    eligibleCids.push(correlationId);

    const sorted = groupRuns.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    eligibleRuns.set(correlationId, sorted);
  }

  const signalCounts = new Map<string, number>();
  if (eligibleCids.length > 0) {
    const { data: allSignals, error: sigErr } = await client
      .from('agent_signals')
      .select('correlation_id')
      .in('correlation_id', eligibleCids);
    if (sigErr) throw sigErr;
    for (const sig of allSignals ?? []) {
      const cid = sig.correlation_id as string;
      signalCounts.set(cid, (signalCounts.get(cid) ?? 0) + 1);
    }
  }

  for (const correlationId of eligibleCids) {
    const sorted = eligibleRuns.get(correlationId)!;
    const agents = [...new Set(sorted.map((r: ActionHistoryRow) => r.agentId))];
    const lastCompleted = [...sorted].reverse().find((r: ActionHistoryRow) => r.completedAt != null);

    groups.push({
      correlationId,
      signalCount: signalCounts.get(correlationId) ?? 0,
      runCount: sorted.length,
      agents,
      firstCreatedAt: sorted[0]?.createdAt ?? new Date().toISOString(),
      lastCompletedAt: lastCompleted?.completedAt ?? null,
      runs: sorted,
      initiatorAgentId: sorted[0]?.agentId ?? null,
    });
  }

  return groups;
}

export async function getRunDetail(
  runId: string,
  workspaceId: string,
): Promise<ActionHistoryRow | null> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .eq('workspace_id', workspaceId)
    .single();
  if (error || !data) return null;
  return { ...mapRun(data as Record<string, unknown>), feedback: null };
}

export async function getRecentActivity(
  workspaceId: string,
  limit = 5,
): Promise<ActionHistoryRow[]> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('agent_runs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('status', ['completed', 'failed', 'timed_out'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...mapRun(row as Record<string, unknown>),
    feedback: null,
  }));
}

export async function getCorrectionChain(
  runId: string,
  workspaceId: string,
): Promise<CorrectionInfo[]> {
  const client = createServiceClient();
  const chain: CorrectionInfo[] = [];
  let currentId: string | null = runId;
  const visited = new Set<string>();
  while (currentId && chain.length < 5) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const { data: children, error } = await client
      .from('agent_runs')
      .select('id, status, corrected_run_id, correction_depth')
      .eq('workspace_id', workspaceId)
      .eq('corrected_run_id', currentId);
    if (error || !children || children.length === 0) break;
    const child = children[0] as Record<string, unknown> | undefined;
    if (!child) break;
    chain.push({
      originalRunId: currentId,
      correctedRunId: child.id as string,
      status: child.status as string,
      depth: child.correction_depth as number,
    });
    currentId = child.id as string;
  }
  return chain;
}
