'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import {
  saveReportTemplateSchema,
} from '@flow/types';
import type {
  ActionResult,
  ReportTemplate,
} from '@flow/types';

export async function saveReportTemplateAction(
  input: unknown,
): Promise<ActionResult<ReportTemplate>> {
  const parsed = saveReportTemplateSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues;
    const sectionCountMin = issues.some(
      (i) =>
        i.path.includes('SECTION_COUNT_MIN') &&
        i.message.includes('At least one section must be enabled'),
    );
    if (sectionCountMin) {
      return {
        success: false,
        error: createFlowError(
          400,
          'SECTION_COUNT_MIN',
          'At least one section must be enabled.',
          'validation',
          { issues },
        ),
      };
    }
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation', { issues }),
    };
  }

  const supabase = await getServerSupabase();
  let ctx;
  try {
    ctx = await requireTenantContext(supabase);
  } catch {
    return {
      success: false,
      error: createFlowError(401, 'AUTH_REQUIRED', 'Authentication required', 'auth'),
    };
  }

  if (!['owner', 'admin'].includes(ctx.role)) {
    return {
      success: false,
      error: createFlowError(403, 'FORBIDDEN', 'Only workspace owners and admins can manage templates.', 'auth'),
    };
  }

  const { id, clientId, name, sectionsConfig, branding } = parsed.data;

  if (clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle();
    if (!client) {
      return {
        success: false,
        error: createFlowError(400, 'VALIDATION_ERROR', 'Client not found in workspace.', 'validation'),
      };
    }
  }

  if (id) {
    const { data: existing } = await supabase
      .from('report_templates')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle();
    if (!existing) {
      return {
        success: false,
        error: createFlowError(404, 'NOT_FOUND', 'Template not found.', 'validation'),
      };
    }
  }

  // Upsert
  const { data: upserted, error: upsertErr } = await supabase
    .from('report_templates')
    .upsert({
      ...(id ? { id } : {}),
      workspace_id: ctx.workspaceId,
      client_id: clientId ?? null,
      name,
      sections_config: sectionsConfig,
      branding,
      updated_at: new Date().toISOString(),
    } satisfies Record<string, unknown> as never)
    .select()
    .single();

  if (upsertErr || !upserted) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', upsertErr?.message ?? 'Failed to save template.', 'system'),
    };
  }

  const result: ReportTemplate = {
    id: upserted.id as string,
    workspaceId: upserted.workspace_id as string,
    clientId: (upserted.client_id as string | null) ?? null,
    name: upserted.name as string,
    sectionsConfig: (upserted.sections_config as Record<string, unknown>) ?? {},
    branding: (upserted.branding as Record<string, unknown>) ?? {},
    createdAt: String(upserted.created_at),
    updatedAt: String(upserted.updated_at),
  };

  return { success: true, data: result };
}
