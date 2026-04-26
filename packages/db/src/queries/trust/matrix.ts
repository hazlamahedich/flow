import { createServiceClient } from '../../client';
import { TrustTransitionError } from '@flow/trust';

interface TrustMatrixDbRow {
  id: string;
  workspace_id: string;
  agent_id: string;
  action_type: string;
  current_level: 'supervised' | 'confirm' | 'auto';
  score: number;
  total_executions: number;
  successful_executions: number;
  consecutive_successes: number;
  violation_count: number;
  last_transition_at: string;
  last_violation_at: string | null;
  cooldown_until: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export type { TrustMatrixDbRow };

type TrustMatrixUpdates = Partial<Pick<TrustMatrixDbRow, 'current_level' | 'score' | 'consecutive_successes' | 'total_executions' | 'successful_executions' | 'violation_count' | 'last_violation_at' | 'last_transition_at' | 'cooldown_until'>>;

async function casUpdate(
  entryId: string,
  updates: Record<string, unknown>,
  expectedVersion: number,
  label: string,
): Promise<TrustMatrixDbRow> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('trust_matrix')
    .update({ ...updates, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .eq('version', expectedVersion)
    .select()
    .single();

  if (error || !data) {
    throw new TrustTransitionError(
      'CONCURRENT_MODIFICATION',
      `CAS ${label} failed (expected v${expectedVersion})`,
      { retryable: false, details: { entryId, expectedVersion } },
    );
  }
  return data;
}

async function getOrThrow(
  workspaceId: string,
  agentId: string,
  actionType: string,
): Promise<TrustMatrixDbRow> {
  const entry = await getTrustMatrixEntry(workspaceId, agentId, actionType);
  if (!entry) {
    throw new TrustTransitionError(
      'CONCURRENT_MODIFICATION',
      `Trust matrix entry not found for ${agentId}:${actionType}`,
      { retryable: false },
    );
  }
  return entry;
}

export async function getTrustMatrix(
  workspaceId: string,
): Promise<TrustMatrixDbRow[]> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('trust_matrix')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('agent_id', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getTrustMatrixEntry(
  workspaceId: string,
  agentId: string,
  actionType: string,
): Promise<TrustMatrixDbRow | null> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('trust_matrix')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('agent_id', agentId)
    .eq('action_type', actionType)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertTrustMatrixEntry(
  workspaceId: string,
  agentId: string,
  actionType: string,
): Promise<TrustMatrixDbRow> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('trust_matrix')
    .upsert(
      { workspace_id: workspaceId, agent_id: agentId, action_type: actionType, current_level: 'supervised', score: 0 },
      { onConflict: 'workspace_id,agent_id,action_type', ignoreDuplicates: true },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTrustMatrixEntry(
  id: string,
  updates: TrustMatrixUpdates,
  expectedVersion: number,
): Promise<TrustMatrixDbRow> {
  return casUpdate(id, updates as Record<string, unknown>, expectedVersion, 'updateTrustMatrixEntry');
}

export async function recordSuccess(
  workspaceId: string,
  agentId: string,
  actionType: string,
  expectedVersion: number,
): Promise<TrustMatrixDbRow> {
  const entry = await getOrThrow(workspaceId, agentId, actionType);
  const scoreDelta = entry.current_level === 'auto' ? 0 : 1;
  return casUpdate(entry.id, {
    score: Math.min(200, entry.score + scoreDelta),
    consecutive_successes: entry.consecutive_successes + 1,
    total_executions: entry.total_executions + 1,
    successful_executions: entry.successful_executions + 1,
  }, expectedVersion, `recordSuccess ${agentId}:${actionType}`);
}

export async function recordViolation(
  workspaceId: string,
  agentId: string,
  actionType: string,
  severity: 'soft' | 'hard',
  riskWeight: number,
  expectedVersion: number,
  cooldownDays: number = 7,
  targetLevel?: 'supervised' | 'confirm' | 'auto',
): Promise<TrustMatrixDbRow> {
  const entry = await getOrThrow(workspaceId, agentId, actionType);
  const penalty = severity === 'hard' ? 20 : 10 * riskWeight;
  const now = new Date();
  const cooldown = new Date(now.getTime() + cooldownDays * 24 * 60 * 60 * 1000);

  const updates: Record<string, unknown> = {
    score: Math.max(0, Math.round(entry.score - penalty)),
    consecutive_successes: 0,
    violation_count: entry.violation_count + 1,
    last_violation_at: now.toISOString(),
    cooldown_until: cooldown.toISOString(),
  };
  if (targetLevel !== undefined) updates.current_level = targetLevel;

  return casUpdate(entry.id, updates, expectedVersion, `recordViolation ${agentId}:${actionType}`);
}

export async function recordPrecheckFailure(
  workspaceId: string,
  agentId: string,
  actionType: string,
  expectedVersion: number,
): Promise<TrustMatrixDbRow> {
  const entry = await getOrThrow(workspaceId, agentId, actionType);
  return casUpdate(entry.id, {
    score: Math.max(0, entry.score - 5),
    total_executions: entry.total_executions + 1,
  }, expectedVersion, `recordPrecheckFailure ${agentId}:${actionType}`);
}
