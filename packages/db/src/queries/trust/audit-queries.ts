import { createServiceClient } from '../../client';
import type {
  TrustEventFilters,
  TrustEventRow,
  TrustEventPage,
  CheckInDueRow,
  AutoActionRow,
} from './audit-types';

const PAGE_SIZE = 25;

const LEVEL_ORDER: Record<string, number> = {
  supervised: 0,
  confirm: 1,
  auto: 2,
};

function isUpgrade(from: string, to: string): boolean {
  return (LEVEL_ORDER[to] ?? 0) > (LEVEL_ORDER[from] ?? 0);
}

function isRegression(from: string, to: string): boolean {
  return (LEVEL_ORDER[to] ?? 0) < (LEVEL_ORDER[from] ?? 0);
}

export async function getTrustEvents(
  workspaceId: string,
  filters: TrustEventFilters,
): Promise<TrustEventPage> {
  const client = createServiceClient();

  let matrixEntryIds: string[] | null = null;
  if (filters.agentId) {
    const { data: entries, error: entriesErr } = await client
      .from('trust_matrix')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('agent_id', filters.agentId);
    if (entriesErr) throw entriesErr;
    if (!entries || entries.length === 0) {
      return { data: [], total: 0, page: filters.page, pageSize: PAGE_SIZE };
    }
    matrixEntryIds = entries.map((r: { id: string }) => r.id);
  }

  let query = client
    .from('trust_transitions')
    .select('id, matrix_entry_id, workspace_id, from_level, to_level, trigger_type, trigger_reason, is_context_shift, actor, created_at, trust_matrix(agent_id)', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (matrixEntryIds) {
    query = query.in('matrix_entry_id', matrixEntryIds);
  }

  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  const page = Math.max(1, filters.page);
  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  if (!data) return { data: [], total: 0, page, pageSize: PAGE_SIZE };

  let rows: TrustEventRow[] = data.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    matrixEntryId: r.matrix_entry_id as string,
    workspaceId: r.workspace_id as string,
    agentId: ((r.trust_matrix as Record<string, unknown>)?.agent_id ?? '') as string,
    fromLevel: r.from_level as string,
    toLevel: r.to_level as string,
    triggerType: r.trigger_type as string,
    triggerReason: r.trigger_reason as string,
    isContextShift: r.is_context_shift as boolean,
    actor: r.actor as string,
    createdAt: r.created_at as string,
  }));

  if (filters.direction && filters.direction !== 'all') {
    rows = rows.filter((r) =>
      filters.direction === 'upgrade'
        ? isUpgrade(r.fromLevel, r.toLevel)
        : isRegression(r.fromLevel, r.toLevel),
    );
  }

  const adjustedTotal = (filters.direction && filters.direction !== 'all')
    ? Math.min(count ?? 0, rows.length + (page - 1) * PAGE_SIZE)
    : (count ?? 0);

  return { data: rows, total: adjustedTotal, page, pageSize: PAGE_SIZE };
}

export async function getCheckInDue(
  workspaceId: string,
): Promise<CheckInDueRow[]> {
  const client = createServiceClient();

  const { data: ws, error: wsErr } = await client
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single();
  if (wsErr) throw wsErr;

  const settings = ws?.settings as Record<string, unknown> | null;
  if (settings?.trust_checkin_enabled !== true && settings?.trust_checkin_enabled !== 'true') {
    return [];
  }

  const { data, error } = await client
    .from('trust_matrix')
    .select(`
      agent_id,
      workspace_id,
      current_level,
      trust_audits(last_reviewed_at, created_at, deferred_count, last_deferred_at)
    `)
    .eq('workspace_id', workspaceId)
    .eq('current_level', 'auto');
  if (error) throw error;
  if (!data) return [];

  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 86_400_000;

  return (data as Record<string, unknown>[])
    .filter((row) => {
      const audit = row.trust_audits as Record<string, unknown> | null;
      const lastReviewed = audit?.last_reviewed_at as string | null;
      const auditCreated = audit?.created_at as string | null;
      const referenceDate = lastReviewed ?? auditCreated;
      if (!referenceDate) return true;
      return now - new Date(referenceDate).getTime() >= THIRTY_DAYS_MS;
    })
    .map((row) => {
      const audit = row.trust_audits as Record<string, unknown> | null;
      return {
        agentId: row.agent_id as string,
        workspaceId: row.workspace_id as string,
        currentLevel: row.current_level as string,
        lastReviewedAt: (audit?.last_reviewed_at as string | null) ?? null,
        auditCreatedAt: (audit?.created_at as string) ?? new Date().toISOString(),
        deferredCount: (audit?.deferred_count as number) ?? 0,
        lastDeferredAt: (audit?.last_deferred_at as string | null) ?? null,
      };
    });
}

export async function getRecentAutoActions(
  workspaceId: string,
  agentId: string,
  limit: number = 7,
): Promise<AutoActionRow[]> {
  const clamped = Math.min(Math.max(limit, 5), 10);
  const client = createServiceClient();

  const { data, error } = await client
    .from('agent_runs')
    .select('id, agent_id, action_type, status, created_at, summary')
    .eq('workspace_id', workspaceId)
    .eq('agent_id', agentId)
    .eq('status', 'completed')
    .gt('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(clamped);

  if (error) throw error;
  if (!data) return [];

  return data.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    agentId: r.agent_id as string,
    actionType: r.action_type as string,
    status: r.status as string,
    createdAt: r.created_at as string,
    summary: (r.summary as string | null) ?? null,
  }));
}
