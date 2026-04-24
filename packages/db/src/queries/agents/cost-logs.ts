import { createServiceClient } from '../../client';

export interface CostLogEntry {
  workspaceId: string;
  agentId: string;
  runId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents?: number;
  actualCostCents?: number;
  logType?: 'estimate' | 'actual';
}

export interface CostLogRow extends CostLogEntry {
  id: string;
  createdAt: string;
}

export async function insertCostEstimate(
  entry: Omit<CostLogEntry, 'actualCostCents' | 'outputTokens'> & { outputTokens?: number },
): Promise<CostLogRow> {
  const client = createServiceClient();
  const row: Record<string, unknown> = {
    workspace_id: entry.workspaceId,
    agent_id: entry.agentId,
    run_id: entry.runId ?? null,
    provider: entry.provider,
    model: entry.model,
    input_tokens: entry.inputTokens,
    output_tokens: entry.outputTokens ?? 0,
    estimated_cost_cents: entry.estimatedCostCents ?? null,
    actual_cost_cents: null,
    log_type: 'estimate',
  };
  const { data, error } = await client
    .from('llm_cost_logs')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function insertCostLog(
  entry: CostLogEntry,
): Promise<CostLogRow> {
  const client = createServiceClient();
  const row: Record<string, unknown> = {
    workspace_id: entry.workspaceId,
    agent_id: entry.agentId,
    run_id: entry.runId ?? null,
    provider: entry.provider,
    model: entry.model,
    input_tokens: entry.inputTokens,
    output_tokens: entry.outputTokens,
    estimated_cost_cents: entry.estimatedCostCents ?? null,
    actual_cost_cents: entry.actualCostCents ?? null,
    log_type: entry.logType ?? 'actual',
  };
  const { data, error } = await client
    .from('llm_cost_logs')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function getWorkspaceSpend(
  workspaceId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('llm_cost_logs')
    .select('actual_cost_cents')
    .eq('workspace_id', workspaceId)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString());
  if (error) throw error;
  return data.reduce((sum: number, row: { actual_cost_cents: number | null }) => {
    return sum + (row.actual_cost_cents ?? 0);
  }, 0);
}

export async function getDailySpend(
  workspaceId: string,
  date: Date,
): Promise<number> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return getWorkspaceSpend(workspaceId, start, end);
}

export async function checkBudgetThreshold(
  workspaceId: string,
  monthlyBudgetCents: number,
  periodStart: Date,
): Promise<{ allowed: boolean; percentUsed: number; alertLevel: 'none' | 'warning' | 'critical' }> {
  if (monthlyBudgetCents <= 0) {
    return { allowed: true, percentUsed: 0, alertLevel: 'none' };
  }
  const now = new Date();
  const spent = await getWorkspaceSpend(workspaceId, periodStart, now);
  const percentUsed = Math.round((spent / monthlyBudgetCents) * 100) / 100;

  if (percentUsed >= 1.0) {
    return { allowed: false, percentUsed, alertLevel: 'critical' };
  }
  if (percentUsed >= 0.8) {
    return { allowed: true, percentUsed, alertLevel: 'warning' };
  }
  return { allowed: true, percentUsed, alertLevel: 'none' };
}

function mapRow(data: Record<string, unknown>): CostLogRow {
  return {
    id: data.id as string,
    workspaceId: data.workspace_id as string,
    agentId: data.agent_id as string,
    runId: (data.run_id as string) ?? undefined,
    provider: data.provider as string,
    model: data.model as string,
    inputTokens: data.input_tokens as number,
    outputTokens: data.output_tokens as number,
    estimatedCostCents: (data.estimated_cost_cents as number) ?? undefined,
    actualCostCents: (data.actual_cost_cents as number) ?? undefined,
    createdAt: data.created_at as string,
  };
}
