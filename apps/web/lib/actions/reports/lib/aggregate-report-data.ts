import type { SupabaseClient } from '@supabase/supabase-js';

function safeNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0]!;
}

export async function aggregateReportData(
  supabase: SupabaseClient,
  workspaceId: string,
  clientId: string,
  periodStart: string,
  periodEnd: string,
) {
  const periodEndNext = nextDay(periodEnd);

  const [timeResult, invResult, agentResult] = await Promise.all([
    supabase
      .from('time_entries')
      .select('duration_minutes, notes, date, client_id, project_id, projects(name)')
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .is('deleted_at', null),
    supabase
      .from('invoices')
      .select('id, total_cents')
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .gte('issue_date', periodStart)
      .lte('issue_date', periodEnd)
      .neq('status', 'voided'),
    supabase
      .from('agent_runs')
      .select('action_type, status')
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .gte('created_at', `${periodStart}T00:00:00Z`)
      .lt('created_at', `${periodEndNext}T00:00:00Z`),
  ]);

  if (timeResult.error || invResult.error || agentResult.error) {
    return {
      error: 'Failed to aggregate report data.',
      data: null,
    };
  }

  const timeRows = timeResult.data;
  const invRows = invResult.data;
  const agentRows = agentResult.data;

  const totalMinutes = timeRows.reduce((sum, r) => sum + safeNum(r.duration_minutes), 0);
  const totalInvoiceCents = invRows.reduce((sum, r) => sum + safeNum(r.total_cents), 0);

  const invoiceIds = invRows.map((r) => r.id as string);
  let totalPaidCents = 0;
  if (invoiceIds.length > 0) {
    const payResult = await supabase
      .from('invoice_payments')
      .select('amount_cents')
      .in('invoice_id', invoiceIds)
      .eq('workspace_id', workspaceId)
      .gte('created_at', `${periodStart}T00:00:00Z`)
      .lte('created_at', `${periodEnd}T23:59:59Z`);

    if (payResult.error) {
      return { error: 'Failed to aggregate payment data.', data: null };
    }
    totalPaidCents = (payResult.data ?? []).reduce((sum, r) => sum + safeNum(r.amount_cents), 0);
  }

  return {
    error: null,
    data: {
      timeRows,
      invRows,
      agentRows,
      totalMinutes,
      totalInvoiceCents,
      totalPaidCents,
      invoiceIds,
    },
  };
}

export function safeStrExport(val: unknown): string {
  return safeStr(val);
}

export { safeNum, safeStr, nextDay };
