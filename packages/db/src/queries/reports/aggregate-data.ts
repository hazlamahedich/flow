import type { SupabaseClient } from '@supabase/supabase-js';

export interface AggregateReportDataOptions {
  workspaceId: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
}

export interface StalledItem {
  type: 'extracted_action' | 'overdue_invoice';
  description: string;
  meta: Record<string, any>;
}

export interface AggregatedReportData {
  timeSummary: {
    totalMinutes: number;
    projectCount: number;
  };
  taskLog: {
    projects: Array<{
      projectName: string;
      entries: Array<{
        date: string;
        durationMinutes: number;
        notes: string;
      }>;
    }>;
  };
  agentActivity: {
    runs: Array<{
      actionType: string;
      status: string;
      count: number;
    }>;
  };
  invoiceSummary: {
    totalCents: number;
    amountPaidCents: number;
    invoiceCount: number;
  };
  stalledItems: StalledItem[];
  hasActivity: boolean;
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

/**
 * Aggregates all data required for generating a weekly client report.
 * Guaranteed tenant isolation: strictly requires workspaceId and filters all queries.
 * Gracefully truncates massive inputs to protect the LLM context budget.
 */
export async function aggregateReportData(
  supabase: SupabaseClient,
  options: AggregateReportDataOptions,
): Promise<AggregatedReportData> {
  const { workspaceId, clientId, periodStart, periodEnd } = options;

  const nextDayStr = new Date(new Date(periodStart).getTime() + 86400000)
    .toISOString()
    .split('T')[0]!;
  // Calculate next day after periodEnd for strict timestamp comparisons
  const d = new Date(`${periodEnd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const periodEndNext = d.toISOString().split('T')[0]!;

  const [timeResult, invResult, agentResult, inboxResult, overdueResult] =
    await Promise.all([
      supabase
        .from('time_entries')
        .select(
          'duration_minutes, notes, date, client_id, project_id, projects(name)',
        )
        .eq('client_id', clientId)
        .eq('workspace_id', workspaceId)
        .gte('date', periodStart)
        .lte('date', periodEnd)
        .is('deleted_at', null),
      supabase
        .from('invoices')
        .select('id, total_cents, status')
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
      supabase
        .from('client_inboxes')
        .select('id')
        .eq('client_id', clientId)
        .eq('workspace_id', workspaceId)
        .maybeSingle(),
      supabase
        .from('invoices')
        .select('id, total_cents, issue_date, status')
        .eq('client_id', clientId)
        .eq('workspace_id', workspaceId)
        .eq('status', 'overdue'),
    ]);

  if (timeResult.error) throw timeResult.error;
  if (invResult.error) throw invResult.error;
  if (agentResult.error) throw agentResult.error;
  if (inboxResult.error) throw inboxResult.error;
  if (overdueResult.error) throw overdueResult.error;

  const timeRows = timeResult.data ?? [];
  const invRows = invResult.data ?? [];
  const agentRows = agentResult.data ?? [];
  const inboxRow = inboxResult.data;
  const overdueRows = overdueResult.data ?? [];

  // Truncate note lists to prevent LLM context pollution
  const maxEntriesPerProject = 50;
  const projectMap = new Map<
    string,
    {
      projectName: string;
      entries: Array<{ date: string; durationMinutes: number; notes: string }>;
    }
  >();
  for (const r of timeRows) {
    const pid = safeStr(r.project_id);
    const pname =
      (r.projects as unknown as { name?: string } | null)?.name ?? 'Default';
    if (!projectMap.has(pid)) {
      projectMap.set(pid, { projectName: pname, entries: [] });
    }
    const list = projectMap.get(pid)!.entries;
    if (list.length < maxEntriesPerProject - 1) {
      // Truncate notes if extremely long
      let rawNote = safeStr(r.notes);
      if (rawNote.length > 200) {
        rawNote = rawNote.slice(0, 197) + '...';
      }
      list.push({
        date: safeStr(r.date),
        durationMinutes: safeNum(r.duration_minutes),
        notes: rawNote,
      });
    } else {
      // Consolidate remaining entries into the final slot
      if (list.length === maxEntriesPerProject - 1) {
        list.push({
          date: safeStr(r.date),
          durationMinutes: safeNum(r.duration_minutes),
          notes: 'And additional unlisted entries...',
        });
      } else {
        list[maxEntriesPerProject - 1]!.durationMinutes += safeNum(
          r.duration_minutes,
        );
      }
    }
  }

  // Invoice calculations
  const totalInvoiceCents = invRows.reduce(
    (sum, r) => sum + safeNum(r.total_cents),
    0,
  );
  const invoiceIds = invRows.map((r) => r.id as string);
  let totalPaidCents = 0;
  if (invoiceIds.length > 0) {
    const { data: payRows, error: payError } = await supabase
      .from('invoice_payments')
      .select('amount_cents')
      .in('invoice_id', invoiceIds)
      .eq('workspace_id', workspaceId)
      .gte('created_at', `${periodStart}T00:00:00Z`)
      .lt('created_at', `${periodEndNext}T00:00:00Z`);
    if (payError) throw payError;
    totalPaidCents = (payRows ?? []).reduce(
      (sum, r) => sum + safeNum(r.amount_cents),
      0,
    );
  }

  // Agent activity calculations
  const counts = new Map<
    string,
    { actionType: string; status: string; count: number }
  >();
  for (const r of agentRows) {
    const actionType = (r.action_type as string) ?? '';
    const status = (r.status as string) ?? '';
    const key = `${actionType}:${status}`;
    if (!counts.has(key)) {
      counts.set(key, { actionType, status, count: 0 });
    }
    counts.get(key)!.count++;
  }

  // Stalled Items calculation (overdue invoices + outstanding actions)
  const stalledItems: StalledItem[] = [];

  for (const inv of overdueRows) {
    stalledItems.push({
      type: 'overdue_invoice',
      description: `Invoice for $${(safeNum(inv.total_cents) / 100).toFixed(2)} is currently overdue (issued on ${inv.issue_date}).`,
      meta: {
        invoiceId: inv.id,
        totalCents: inv.total_cents,
        issueDate: inv.issue_date,
      },
    });
  }

  if (inboxRow) {
    const { data: actions, error: actionsError } = await supabase
      .from('extracted_actions')
      .select('id, description, due_date, confidence')
      .eq('workspace_id', workspaceId)
      .eq('client_inbox_id', inboxRow.id)
      .eq('soft_deleted', false)
      .or(`due_date.is.null,due_date.lte.${new Date().toISOString()}`)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (actionsError) throw actionsError;

    for (const act of actions ?? []) {
      let desc = safeStr(act.description);
      if (desc.length > 200) {
        desc = desc.slice(0, 197) + '...';
      }
      stalledItems.push({
        type: 'extracted_action',
        description:
          `Outstanding action item: "${desc}"` +
          (act.due_date ? ` (due ${act.due_date.slice(0, 10)})` : ''),
        meta: {
          actionId: act.id,
          dueDate: act.due_date,
          confidence: act.confidence,
        },
      });
    }
  }

  const totalMinutes = timeRows.reduce(
    (sum, r) => sum + safeNum(r.duration_minutes),
    0,
  );
  const hasActivity =
    totalMinutes > 0 ||
    invRows.length > 0 ||
    agentRows.length > 0 ||
    stalledItems.length > 0;

  return {
    timeSummary: {
      totalMinutes,
      projectCount: projectMap.size,
    },
    taskLog: {
      projects: Array.from(projectMap.values()),
    },
    agentActivity: {
      runs: Array.from(counts.values()),
    },
    invoiceSummary: {
      totalCents: totalInvoiceCents,
      amountPaidCents: totalPaidCents,
      invoiceCount: invoiceIds.length,
    },
    stalledItems,
    hasActivity,
  };
}
