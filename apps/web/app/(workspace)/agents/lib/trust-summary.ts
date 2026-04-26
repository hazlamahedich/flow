import { getServerSupabase } from '@/lib/supabase-server';
import type { AgentId } from '@flow/types';

export const CANONICAL_ACTION_TYPE = 'general';

export interface TrustSummaryRow {
  workspaceId: string;
  agentId: AgentId;
  currentLevel: 'supervised' | 'confirm' | 'auto';
  score: number;
  consecutiveSuccesses: number;
  totalExecutions: number;
  successfulExecutions: number;
  violationCount: number;
  lastTransitionAt: string;
  lastViolationAt: string | null;
}

export async function getTrustSummaryForWorkspace(
  workspaceId: string,
): Promise<TrustSummaryRow[]> {
  const client = await getServerSupabase();

  let query = client
    .from('trust_matrix')
    .select('workspace_id, agent_id, action_type, current_level, score, consecutive_successes, total_executions, successful_executions, violation_count, last_transition_at, last_violation_at')
    .eq('workspace_id', workspaceId);

  query = query.eq('action_type', CANONICAL_ACTION_TYPE);

  const { data, error } = await query;

  if (error) throw error;
  if (!data) return [];

  return data.map((row) => ({
    workspaceId: row.workspace_id,
    agentId: row.agent_id as AgentId,
    currentLevel: row.current_level as 'supervised' | 'confirm' | 'auto',
    score: row.score,
    consecutiveSuccesses: row.consecutive_successes,
    totalExecutions: row.total_executions,
    successfulExecutions: row.successful_executions,
    violationCount: row.violation_count,
    lastTransitionAt: row.last_transition_at,
    lastViolationAt: row.last_violation_at,
  }));
}

export async function getTrustMilestones(
  workspaceId: string,
  agentId?: AgentId,
): Promise<Array<{ agentId: AgentId; milestoneType: string; threshold: number; achievedAt: string; acknowledgedAt: string | null }>> {
  const client = await getServerSupabase();
  let query = client
    .from('trust_milestones')
    .select('agent_id, milestone_type, threshold, achieved_at, acknowledged_at')
    .eq('workspace_id', workspaceId);

  if (agentId) {
    query = query.eq('agent_id', agentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data) return [];

  return data.map((row) => ({
    agentId: row.agent_id as AgentId,
    milestoneType: row.milestone_type,
    threshold: row.threshold,
    achievedAt: row.achieved_at,
    acknowledgedAt: row.acknowledged_at,
  }));
}
