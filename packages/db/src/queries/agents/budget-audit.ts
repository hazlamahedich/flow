import { createServiceClient } from '../../client';

export interface BudgetAlertEntry {
  workspaceId: string;
  alertLevel: 'warning' | 'critical';
  percentUsed: number;
  monthlyBudgetCents: number;
  periodSpendCents: number;
  agentId?: string;
}

export async function writeBudgetAuditAlert(entry: BudgetAlertEntry): Promise<void> {
  const client = createServiceClient();
  const { error } = await client.from('audit_log').insert({
    workspace_id: entry.workspaceId,
    action: `budget.alert.${entry.alertLevel}`,
    entity_type: 'workspace_settings',
    entity_id: null,
    details: {
      alertLevel: entry.alertLevel,
      percentUsed: entry.percentUsed,
      monthlyBudgetCents: entry.monthlyBudgetCents,
      periodSpendCents: entry.periodSpendCents,
      agentId: entry.agentId ?? null,
    },
  });
  if (error) throw error;
}

export async function hasBudgetAlertThisPeriod(
  workspaceId: string,
  alertLevel: 'warning' | 'critical',
  periodStart: Date,
): Promise<boolean> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('audit_log')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('action', `budget.alert.${alertLevel}`)
    .gte('created_at', periodStart.toISOString())
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
