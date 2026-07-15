'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import type {
  ActionResult,
  WeeklyReport,
  WeeklyReportSection,
} from '@flow/types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ReportDetailResult {
  report: WeeklyReport;
  sections: WeeklyReportSection[];
  role: string;
}

function safeStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

function nullSafeStr(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  return String(val);
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

export async function getWeeklyReportByIdAction(
  reportId: string,
): Promise<ActionResult<ReportDetailResult>> {
  if (!UUID_RE.test(reportId)) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        'Invalid report ID format.',
        'validation',
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

  const { data: reportRow, error: reportErr } = await supabase
    .from('weekly_reports')
    .select('*, clients(name)')
    .eq('id', reportId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (reportErr) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to fetch report.',
        'system',
      ),
    };
  }

  if (!reportRow) {
    return {
      success: false,
      error: createFlowError(
        404,
        'NOT_FOUND',
        'Report not found.',
        'validation',
      ),
    };
  }

  const { data: sectionRows, error: sectionErr } = await supabase
    .from('weekly_report_sections')
    .select('*')
    .eq('report_id', reportId)
    .order('sort_order', { ascending: true });

  if (sectionErr) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to fetch report sections.',
        'system',
      ),
    };
  }

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
    data: { report, sections, role: ctx.role },
  };
}
