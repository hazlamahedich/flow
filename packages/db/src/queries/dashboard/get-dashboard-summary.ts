import type { SupabaseClient } from '@supabase/supabase-js';

export interface DashboardSummary {
  pendingApprovals: number;
  agentActivityCount: number;
  outstandingInvoices: number;
  clientHealthAlerts: number;
}

type CountKey = keyof DashboardSummary;

const TABLE_MAP: Record<CountKey, string> = {
  pendingApprovals: 'agent_approvals',
  agentActivityCount: 'agent_runs',
  outstandingInvoices: 'invoices',
  clientHealthAlerts: 'client_health_alerts',
};

class DashboardQueryError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function safeCount(
  client: SupabaseClient,
  workspaceId: string,
  table: string,
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (error) {
    if (error.code === '42P01') return 0;
    throw new DashboardQueryError(error.code, error.message);
  }

  return count ?? 0;
}

export async function getDashboardSummary(
  client: SupabaseClient,
  workspaceId: string,
): Promise<DashboardSummary> {
  const entries = Object.entries(TABLE_MAP) as [CountKey, string][];

  const results = await Promise.allSettled(
    entries.map(([key, table]) =>
      safeCount(client, workspaceId, table).then((count) => [key, count] as const),
    ),
  );

  const summary: DashboardSummary = {
    pendingApprovals: 0,
    agentActivityCount: 0,
    outstandingInvoices: 0,
    clientHealthAlerts: 0,
  };

  const nonGracefulErrors: DashboardQueryError[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      summary[result.value[0]] = result.value[1];
    } else {
      const err = result.reason;
      if (err instanceof DashboardQueryError) {
        nonGracefulErrors.push(err);
      } else if (err instanceof Error) {
        nonGracefulErrors.push(new DashboardQueryError('UNKNOWN', err.message));
      }
    }
  }

  if (nonGracefulErrors.length > 0) {
    throw nonGracefulErrors[0]!;
  }

  return summary;
}
