import type { SupabaseClient } from '@supabase/supabase-js';

export interface UsageAnalytics {
  agentCompletionRate: number;
  agentApprovalRate: number;
  trustDistribution: Record<string, number>;
  tasksCompleted: number;
  timeSavedMinutes: number;
}

function sinceDate(periodDays: number): string {
  return new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
}

export async function getUsageAnalytics(
  client: SupabaseClient,
  workspaceId: string,
  periodDays: number,
): Promise<UsageAnalytics> {
  const from = sinceDate(periodDays);

  const [completedRes, failedRes] = await Promise.all([
    client
      .from('agent_runs')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .gte('created_at', from),
    client
      .from('agent_runs')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'failed')
      .gte('created_at', from),
  ]);

  const completed = completedRes.count ?? 0;
  const failed = failedRes.count ?? 0;
  const totalRuns = completed + failed;
  const agentCompletionRate = totalRuns > 0 ? completed / totalRuns : 0;

  const [approvedRes, rejectedRes, modifiedRes] = await Promise.all([
    client
      .from('agent_approvals')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('decision', 'approved')
      .gte('created_at', from),
    client
      .from('agent_approvals')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('decision', 'rejected')
      .gte('created_at', from),
    client
      .from('agent_approvals')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('decision', 'modified')
      .gte('created_at', from),
  ]);

  const approved = approvedRes.count ?? 0;
  const rejected = rejectedRes.count ?? 0;
  const modified = modifiedRes.count ?? 0;
  const totalDecisions = approved + rejected + modified;
  const agentApprovalRate = totalDecisions > 0 ? approved / totalDecisions : 0;

  const { data: trustRows } = await client
    .from('trust_snapshots')
    .select('trust_level')
    .eq('workspace_id', workspaceId)
    .gte('recorded_at', from);

  const trustDistribution: Record<string, number> = {};
  for (const row of trustRows ?? []) {
    const level = row.trust_level;
    trustDistribution[level] = (trustDistribution[level] ?? 0) + 1;
  }

  const tasksCompleted = completed;
  const timeSavedMinutes = tasksCompleted * 5;

  return {
    agentCompletionRate,
    agentApprovalRate,
    trustDistribution,
    tasksCompleted,
    timeSavedMinutes,
  };
}
