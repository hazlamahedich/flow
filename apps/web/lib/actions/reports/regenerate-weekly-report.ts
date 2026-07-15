'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import type {
  ActionResult,
  WeeklyReport,
  WeeklyReportSection,
} from '@flow/types';
import { aggregateReportData } from './lib/aggregate-report-data';
import { buildReportSections } from './lib/build-report-sections';

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

interface RegenerateReportResult {
  report: WeeklyReport;
  sections: WeeklyReportSection[];
}

function classifyRpcError(msg: string) {
  if (msg.includes('CONCURRENT_MODIFICATION')) {
    return createFlowError(
      409,
      'CONCURRENT_MODIFICATION',
      'This report was modified by another user. Please refresh and try again.',
      'validation',
    );
  }
  if (msg.includes('NOT_FOUND')) {
    return createFlowError(
      404,
      'NOT_FOUND',
      'Report no longer exists.',
      'validation',
    );
  }
  return createFlowError(
    500,
    'INTERNAL_ERROR',
    'Failed to regenerate report. Please try again.',
    'system',
  );
}

export async function regenerateWeeklyReportAction(input: {
  reportId: string;
  expectedVersion: number;
}): Promise<ActionResult<RegenerateReportResult>> {
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
        'Only workspace owners and admins can regenerate reports.',
        'auth',
      ),
    };
  }

  const { reportId, expectedVersion } = input;

  const { data: existingReport, error: fetchErr } = await supabase
    .from('weekly_reports')
    .select('*')
    .eq('id', reportId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (fetchErr || !existingReport) {
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

  const aggResult = await aggregateReportData(
    supabase,
    ctx.workspaceId,
    existingReport.client_id as string,
    safeStr(existingReport.period_start),
    safeStr(existingReport.period_end),
  );

  if (aggResult.error || !aggResult.data) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        aggResult.error ?? 'Failed to aggregate report data.',
        'system',
      ),
    };
  }

  let templateSnapshot =
    (existingReport.template_snapshot as Record<string, unknown>) ?? {};

  if (existingReport.template_id) {
    const { data: tplData } = await supabase
      .from('report_templates')
      .select('sections_config, branding')
      .eq('id', existingReport.template_id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle();
    if (tplData) {
      templateSnapshot = {
        sections_config: tplData.sections_config ?? {},
        branding: tplData.branding ?? {},
      };
    }
  }

  const sectionsPayload = buildReportSections(aggResult.data, templateSnapshot);
  const status = existingReport.status as string;

  try {
    if (status === 'draft') {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'regenerate_draft_report',
        {
          p_report_id: reportId,
          p_expected_version: expectedVersion,
          p_generated_by: ctx.userId,
          p_sections: sectionsPayload,
        },
      );

      if (rpcError) {
        return {
          success: false,
          error: classifyRpcError(rpcError.message ?? ''),
        };
      }

      const { data: reportRow, error: reportErr } = await supabase
        .from('weekly_reports')
        .select('*')
        .eq('id', rpcResult)
        .single();

      if (reportErr || !reportRow) {
        return {
          success: false,
          error: createFlowError(
            500,
            'INTERNAL_ERROR',
            'Report regenerated but could not be retrieved.',
            'system',
          ),
        };
      }

      const { data: sectionRows } = await supabase
        .from('weekly_report_sections')
        .select('*')
        .eq('report_id', rpcResult)
        .order('sort_order', { ascending: true });

      return {
        success: true,
        data: {
          report: mapReport(reportRow),
          sections: mapSections(sectionRows),
        },
      };
    }

    if (status === 'sent' || status === 'viewed') {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'clone_sent_report',
        {
          p_report_id: reportId,
          p_generated_by: ctx.userId,
          p_template_snapshot: templateSnapshot,
          p_sections: sectionsPayload,
        },
      );

      if (rpcError) {
        return {
          success: false,
          error: classifyRpcError(rpcError.message ?? ''),
        };
      }

      const { data: reportRow, error: reportErr } = await supabase
        .from('weekly_reports')
        .select('*')
        .eq('id', rpcResult)
        .single();

      if (reportErr || !reportRow) {
        return {
          success: false,
          error: createFlowError(
            500,
            'INTERNAL_ERROR',
            'Report regenerated but could not be retrieved.',
            'system',
          ),
        };
      }

      const { data: sectionRows } = await supabase
        .from('weekly_report_sections')
        .select('*')
        .eq('report_id', rpcResult)
        .order('sort_order', { ascending: true });

      return {
        success: true,
        data: {
          report: mapReport(reportRow),
          sections: mapSections(sectionRows),
        },
      };
    }
  } catch {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to regenerate report. Please try again.',
        'system',
      ),
    };
  }

  return {
    success: false,
    error: createFlowError(
      400,
      'VALIDATION_ERROR',
      'Cannot regenerate a report in this status.',
      'validation',
    ),
  };
}

function mapReport(row: Record<string, unknown>): WeeklyReport {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    clientId: row.client_id as string,
    periodStart: safeStr(row.period_start),
    periodEnd: safeStr(row.period_end),
    status: row.status as WeeklyReport['status'],
    templateId: (row.template_id as string | null) ?? null,
    generatedBy: row.generated_by as string,
    generatedAt: nullSafeStr(row.generated_at) ?? '',
    sentAt: nullSafeStr(row.sent_at),
    version: safeNum(row.version),
    parentReportId: (row.parent_report_id as string | null) ?? null,
    versionGroupId: (row.version_group_id as string | null) ?? null,
    templateSnapshot: (row.template_snapshot as Record<string, unknown>) ?? {},
    createdAt: nullSafeStr(row.created_at) ?? '',
    updatedAt: nullSafeStr(row.updated_at) ?? '',
  };
}

function mapSections(
  rows: Array<Record<string, unknown>> | null,
): WeeklyReportSection[] {
  return (rows ?? []).map((s) => ({
    id: s.id as string,
    reportId: s.report_id as string,
    sectionType: s.section_type as WeeklyReportSection['sectionType'],
    title: s.title as string,
    content: (s.content as Record<string, unknown>) ?? {},
    sortOrder: safeNum(s.sort_order),
    createdAt: safeStr(s.created_at),
  }));
}
