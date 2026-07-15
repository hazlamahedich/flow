'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import type {
  ActionResult,
  ReportListItem,
  PaginatedResult,
  ReportStatus,
} from '@flow/types';

export async function getWeeklyReportsAction(
  page: number = 1,
  clientId?: string,
): Promise<ActionResult<PaginatedResult<ReportListItem>>> {
  const supabase = await getServerSupabase();
  let ctx;
  try {
    ctx = await requireTenantContext(supabase);
  } catch {
    return {
      success: false,
      error: createFlowError(
        401,
        'AUTH_REQUIRED',
        'Authentication required',
        'auth',
      ),
    };
  }

  if (!['owner', 'admin', 'member'].includes(ctx.role)) {
    return {
      success: false,
      error: createFlowError(
        403,
        'FORBIDDEN',
        'Access denied to reports.',
        'auth',
      ),
    };
  }

  const pageSize = 20;
  const from = (Math.max(page, 1) - 1) * pageSize;
  const to = from + pageSize - 1;

  let countQuery = supabase
    .from('weekly_reports')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId);

  let listQuery = supabase
    .from('weekly_reports')
    .select(
      'id, client_id, period_start, period_end, status, generated_at, version, clients(name)',
    )
    .eq('workspace_id', ctx.workspaceId)
    .order('generated_at', { ascending: false })
    .range(from, to);

  if (clientId) {
    countQuery = countQuery.eq('client_id', clientId);
    listQuery = listQuery.eq('client_id', clientId);
  }

  const [countResult, queryResult] = await Promise.all([countQuery, listQuery]);

  if (queryResult.error || countResult.error) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to fetch reports.',
        'system',
      ),
    };
  }

  const items: ReportListItem[] = (queryResult.data ?? []).map(
    (r: Record<string, unknown>) => ({
      id: r.id as string,
      clientId: r.client_id as string,
      clientName: ((r.clients as Record<string, unknown> | null)?.name ??
        '') as string,
      periodStart: String(r.period_start),
      periodEnd: String(r.period_end),
      status: r.status as ReportStatus,
      generatedAt: String(r.generated_at),
      version: Number(r.version),
    }),
  );

  const total = countResult.count ?? 0;

  return {
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      hasNextPage: total > page * pageSize,
    },
  };
}
