'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import { generateWeeklyReportSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import type { WeeklyReport, WeeklyReportSection } from '@flow/types';

interface GenerateReportResult {
  report: WeeklyReport;
  sections: WeeklyReportSection[];
}

const SECTION_ORDER: Array<{ type: string; title: string }> = [
  { type: 'time_summary', title: 'Time Summary' },
  { type: 'task_log', title: 'Task Log' },
  { type: 'agent_activity', title: 'Agent Activity' },
  { type: 'invoice_summary', title: 'Invoice Summary' },
];

function validateResult<T>(result: {
  data: T | null;
  error: unknown;
}): result is { data: T; error: null } {
  return result.error === null && result.data !== null;
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

function nullSafeStr(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  return String(val);
}

function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0]!;
}

export async function generateWeeklyReportAction(
  input: unknown,
): Promise<ActionResult<GenerateReportResult>> {
  const parsed = generateWeeklyReportSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues;
    const periodTooLong = issues.some(
      (i) => i.path.includes('periodEnd') && i.message.includes('31 days'),
    );
    const invalidOrder = issues.some(
      (i) =>
        i.path.includes('periodStart') && i.message.includes('<= periodEnd'),
    );
    if (periodTooLong) {
      return {
        success: false,
        error: createFlowError(
          400,
          'PERIOD_TOO_LONG',
          'Date range must not exceed 31 days.',
          'validation',
          { issues },
        ),
      };
    }
    if (invalidOrder) {
      return {
        success: false,
        error: createFlowError(
          400,
          'INVALID_DATE_RANGE',
          'periodStart must be <= periodEnd.',
          'validation',
          { issues },
        ),
      };
    }
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.message,
        'validation',
        { issues },
      ),
    };
  }

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

  if (!['owner', 'admin'].includes(ctx.role)) {
    return {
      success: false,
      error: createFlowError(
        403,
        'FORBIDDEN',
        'Only workspace owners and admins can generate reports.',
        'auth',
      ),
    };
  }

  const { clientId, periodStart, periodEnd, templateId } = parsed.data;
  const periodEndNext = nextDay(periodEnd);

  const clientResult = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (clientResult.error || !clientResult.data) {
    return {
      success: false,
      error: createFlowError(
        404,
        'CLIENT_NOT_FOUND',
        'Client not found in workspace.',
        'validation',
      ),
    };
  }

  let resolvedTemplateId: string | null = templateId ?? null;
  let templateSnapshot: Record<string, unknown> = {};

  if (resolvedTemplateId) {
    const tplResult = await supabase
      .from('report_templates')
      .select('id, sections_config, branding')
      .eq('id', resolvedTemplateId)
      .eq('workspace_id', ctx.workspaceId)
      .or(`client_id.eq.${clientId},client_id.is.null`)
      .maybeSingle();
    if (tplResult.data) {
      templateSnapshot = {
        sections_config: tplResult.data.sections_config ?? {},
        branding: tplResult.data.branding ?? {},
      };
    } else {
      resolvedTemplateId = null;
    }
  }

  if (!resolvedTemplateId) {
    // Try per-client template first
    const clientTplResult = await supabase
      .from('report_templates')
      .select('id, sections_config, branding')
      .eq('workspace_id', ctx.workspaceId)
      .eq('client_id', clientId)
      .maybeSingle();
    if (clientTplResult.data) {
      resolvedTemplateId = clientTplResult.data.id;
      templateSnapshot = {
        sections_config: clientTplResult.data.sections_config ?? {},
        branding: clientTplResult.data.branding ?? {},
      };
    }
  }

  if (!resolvedTemplateId) {
    // Fall back to workspace default
    const defaultResult = await supabase
      .from('report_templates')
      .select('id, sections_config, branding')
      .eq('workspace_id', ctx.workspaceId)
      .is('client_id', null)
      .maybeSingle();
    if (defaultResult.data) {
      resolvedTemplateId = defaultResult.data.id;
      templateSnapshot = {
        sections_config: defaultResult.data.sections_config ?? {},
        branding: defaultResult.data.branding ?? {},
      };
    }
  }

  // Hardcoded fallback if absolutely nothing
  const sectionsConfig =
    (templateSnapshot.sections_config as
      | Record<string, { enabled?: boolean; sort_order?: number }>
      | undefined) ?? {};
  const fallbackOrder = [
    'time_summary',
    'task_log',
    'agent_activity',
    'invoice_summary',
  ] as const;
  const hasEnabledConfig = Object.keys(sectionsConfig).length > 0;

  // Build ordered section list respecting enabled flags
  const orderedSections = hasEnabledConfig
    ? Object.entries(sectionsConfig)
        .filter(([, cfg]) => cfg?.enabled)
        .sort(([, a], [, b]) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0))
        .map(([type]) => type)
    : fallbackOrder.map((t) => t);

  // Preserve sort_order in payload for each section
  const sectionOrderMap = new Map<string, number>();
  for (const [type, cfg] of Object.entries(sectionsConfig)) {
    sectionOrderMap.set(type, cfg?.sort_order ?? 0);
  }

  const [timeResult, invResult, agentResult] = await Promise.all([
    supabase
      .from('time_entries')
      .select(
        'duration_minutes, notes, date, client_id, project_id, projects(name)',
      )
      .eq('client_id', clientId)
      .eq('workspace_id', ctx.workspaceId)
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .is('deleted_at', null),
    supabase
      .from('invoices')
      .select('id, total_cents')
      .eq('client_id', clientId)
      .eq('workspace_id', ctx.workspaceId)
      .gte('issue_date', periodStart)
      .lte('issue_date', periodEnd)
      .neq('status', 'voided'),
    supabase
      .from('agent_runs')
      .select('action_type, status')
      .eq('client_id', clientId)
      .eq('workspace_id', ctx.workspaceId)
      .gte('created_at', `${periodStart}T00:00:00Z`)
      .lt('created_at', `${periodEndNext}T00:00:00Z`),
  ]);

  if (
    !validateResult(timeResult) ||
    !validateResult(invResult) ||
    !validateResult(agentResult)
  ) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to aggregate report data.',
        'system',
      ),
    };
  }

  const timeRows = timeResult.data;
  const invRows = invResult.data;
  const agentRows = agentResult.data;

  const totalMinutes = timeRows.reduce(
    (sum, r) => sum + safeNum(r.duration_minutes),
    0,
  );

  const totalInvoiceCents = invRows.reduce(
    (sum, r) => sum + safeNum(r.total_cents),
    0,
  );

  const invoiceIds = invRows.map((r) => r.id as string);
  let totalPaidCents = 0;
  if (invoiceIds.length > 0) {
    const payResult = await supabase
      .from('invoice_payments')
      .select('amount_cents')
      .in('invoice_id', invoiceIds)
      .eq('workspace_id', ctx.workspaceId)
      .gte('created_at', `${periodStart}T00:00:00Z`)
      .lte('created_at', `${periodEnd}T23:59:59Z`);

    if (payResult.error) {
      return {
        success: false,
        error: createFlowError(
          500,
          'INTERNAL_ERROR',
          'Failed to aggregate payment data.',
          'system',
        ),
      };
    }

    totalPaidCents = (payResult.data ?? []).reduce(
      (sum, r) => sum + safeNum(r.amount_cents),
      0,
    );
  }

  const sectionsPayload: Array<Record<string, unknown>> = [];

  for (const secType of orderedSections) {
    const sectionDef = SECTION_ORDER.find((s) => s.type === secType)!;
    let content: Record<string, unknown> = {};
    if (secType === 'time_summary') {
      content = { totalMinutes };
    } else if (secType === 'task_log') {
      const projectMap = new Map<
        string,
        {
          projectName: string;
          entries: Array<{
            date: string;
            durationMinutes: number;
            notes: string;
          }>;
        }
      >();
      for (const r of timeRows) {
        const pid = safeStr(r.project_id);
        const pname =
          (r.projects as unknown as { name?: string } | null)?.name ?? '';
        if (!projectMap.has(pid)) {
          projectMap.set(pid, { projectName: pname, entries: [] });
        }
        projectMap.get(pid)!.entries.push({
          date: safeStr(r.date),
          durationMinutes: safeNum(r.duration_minutes),
          notes: safeStr(r.notes),
        });
      }
      content = {
        projects: Array.from(projectMap.values()),
      };
    } else if (secType === 'agent_activity') {
      const counts = new Map<
        string,
        { actionType: string; status: string; count: number }
      >();
      for (const r of agentRows) {
        const actionType = (r.action_type as string) ?? '';
        const status = (r.status as string) ?? '';
        const key = JSON.stringify([actionType, status]);
        if (!counts.has(key)) {
          counts.set(key, { actionType, status, count: 0 });
        }
        counts.get(key)!.count++;
      }
      content = {
        runs: Array.from(counts.values()),
      };
    } else if (secType === 'invoice_summary') {
      content = {
        totalCents: totalInvoiceCents,
        amountPaidCents: totalPaidCents,
        invoiceCount: invoiceIds.length,
      };
    }

    sectionsPayload.push({
      section_type: secType,
      title: sectionDef.title,
      sort_order: sectionOrderMap.get(secType) ?? 0,
      content,
    });
  }

  const { data: reportId, error: rpcError } = await supabase.rpc(
    'create_weekly_report_with_sections',
    {
      p_workspace_id: ctx.workspaceId,
      p_client_id: clientId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_template_id: resolvedTemplateId,
      p_generated_by: ctx.userId,
      p_template_snapshot: templateSnapshot,
      p_sections: sectionsPayload,
    },
  );

  if (rpcError || !reportId) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        rpcError?.message ?? 'Failed to generate report.',
        'system',
      ),
    };
  }

  const { data: reportRow, error: reportErr } = await supabase
    .from('weekly_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (reportErr || !reportRow) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Report created but could not be retrieved.',
        'system',
      ),
    };
  }

  const { data: sectionRows } = await supabase
    .from('weekly_report_sections')
    .select('*')
    .eq('report_id', reportId)
    .order('sort_order', { ascending: true });

  const report: WeeklyReport = {
    id: reportRow.id as string,
    workspaceId: reportRow.workspace_id as string,
    clientId: reportRow.client_id as string,
    periodStart: safeStr(reportRow.period_start),
    periodEnd: safeStr(reportRow.period_end),
    status: reportRow.status as WeeklyReport['status'],
    templateId: (reportRow.template_id as string | null) ?? null,
    generatedBy: reportRow.generated_by as string,
    generatedAt: nullSafeStr(reportRow.generated_at) ?? '',
    sentAt: nullSafeStr(reportRow.sent_at),
    version: safeNum(reportRow.version),
    parentReportId: (reportRow.parent_report_id as string | null) ?? null,
    versionGroupId: (reportRow.version_group_id as string | null) ?? null,
    templateSnapshot:
      (reportRow.template_snapshot as Record<string, unknown>) ?? {},
    createdAt: nullSafeStr(reportRow.created_at) ?? '',
    updatedAt: nullSafeStr(reportRow.updated_at) ?? '',
  };

  const sections: WeeklyReportSection[] = (sectionRows ?? []).map(
    (s: Record<string, unknown>) => ({
      id: s.id as string,
      reportId: s.report_id as string,
      sectionType: s.section_type as WeeklyReportSection['sectionType'],
      title: s.title as string,
      content: (s.content as Record<string, unknown>) ?? {},
      sortOrder: safeNum(s.sort_order),
      createdAt: safeStr(s.created_at),
    }),
  );

  return {
    success: true,
    data: { report, sections },
  };
}
