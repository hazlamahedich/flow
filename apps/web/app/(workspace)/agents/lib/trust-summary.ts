import { getServerSupabase } from '@/lib/supabase-server';
import type { AgentId } from '@flow/types';
import { z } from 'zod';

export const CANONICAL_ACTION_TYPE = 'general';

const trustMatrixRowSchema = z.object({
  workspace_id: z.string(),
  agent_id: z.string(),
  action_type: z.string(),
  current_level: z.enum(['supervised', 'confirm', 'auto']),
  score: z.number(),
  consecutive_successes: z.number(),
  total_executions: z.number(),
  successful_executions: z.number(),
  violation_count: z.number(),
  last_transition_at: z.string(),
  last_violation_at: z.string().nullable().optional(),
}).passthrough();

const trustMilestoneRowSchema = z.object({
  agent_id: z.string(),
  milestone_type: z.string(),
  threshold: z.number(),
  achieved_at: z.string(),
  acknowledged_at: z.string().nullable().optional(),
}).passthrough();

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

  return data.map((row) => {
    const parsed = trustMatrixRowSchema.parse(row);
    return {
      workspaceId: parsed.workspace_id,
      agentId: parsed.agent_id as AgentId,
      currentLevel: parsed.current_level,
      score: parsed.score,
      consecutiveSuccesses: parsed.consecutive_successes,
      totalExecutions: parsed.total_executions,
      successfulExecutions: parsed.successful_executions,
      violationCount: parsed.violation_count,
      lastTransitionAt: parsed.last_transition_at,
      lastViolationAt: parsed.last_violation_at ?? null,
    };
  });
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

  return data.map((row) => {
    const parsed = trustMilestoneRowSchema.parse(row);
    return {
      agentId: parsed.agent_id as AgentId,
      milestoneType: parsed.milestone_type,
      threshold: parsed.threshold,
      achievedAt: parsed.achieved_at,
      acknowledgedAt: parsed.acknowledged_at ?? null,
    };
  });
}
