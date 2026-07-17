import type { SupabaseClient } from '@supabase/supabase-js';
import { cacheTag } from '../../cache-policy';

export interface DashboardSummary {
  pendingApprovals: number;
  agentActivityCount: number;
  outstandingInvoices: number;
  clientHealthAlerts: number;
  clientCount: number;
}

type CountKey =
  | 'pendingApprovals'
  | 'agentActivityCount'
  | 'outstandingInvoices'
  | 'clientCount';

const TABLE_MAP: Record<CountKey, string> = {
  pendingApprovals: 'agent_approvals',
  agentActivityCount: 'agent_runs',
  outstandingInvoices: 'invoices',
  clientCount: 'clients',
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

async function getClientHealthAlertCount(
  client: SupabaseClient,
  workspaceId: string,
): Promise<number> {
  try {
    // Uses DB function to count only the latest snapshot per client,
    // preventing stale at-risk rows from inflating the alert count.
    const { data, error } = await client.rpc('get_client_health_alert_count', {
      p_workspace_id: workspaceId,
    });

    if (error) {
      if (error.code === '42883' || error.code === '42P01') return 0; // function/table missing: graceful
      throw new DashboardQueryError(error.code, error.message);
    }

    return typeof data === 'number' ? data : Number(data ?? 0);
  } catch (err: unknown) {
    if (err instanceof DashboardQueryError) throw err;
    return 0;
  }
}

export async function getDashboardSummary(
  client: SupabaseClient,
  workspaceId: string,
): Promise<DashboardSummary> {
  const entries = Object.entries(TABLE_MAP) as [CountKey, string][];

  const [tableResults, healthAlertCount] = await Promise.all([
    Promise.allSettled(
      entries.map(([key, table]) =>
        safeCount(client, workspaceId, table).then(
          (count) => [key, count] as const,
        ),
      ),
    ),
    getClientHealthAlertCount(client, workspaceId),
  ]);

  const summary: DashboardSummary = {
    pendingApprovals: 0,
    agentActivityCount: 0,
    outstandingInvoices: 0,
    clientHealthAlerts: healthAlertCount,
    clientCount: 0,
  };

  const nonGracefulErrors: DashboardQueryError[] = [];

  for (const result of tableResults) {
    if (result.status === 'fulfilled') {
      summary[result.value[0]] = result.value[1];
    } else {
      const err = result.reason;
      if (err instanceof DashboardQueryError) {
        nonGracefulErrors.push(err);
      } else if (err instanceof Error) {
        nonGracefulErrors.push(new DashboardQueryError('UNKNOWN', err.message));
      } else {
        nonGracefulErrors.push(new DashboardQueryError('UNKNOWN', String(err)));
      }
    }
  }

  if (nonGracefulErrors.length > 0) {
    throw nonGracefulErrors[0]!;
  }

  return summary;
}

export function getDashboardCacheTag(workspaceId: string): string {
  return cacheTag('dashboard', workspaceId);
}
