'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import { deleteReportTemplateSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';

export async function deleteReportTemplateAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteReportTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.message,
        'validation',
        { issues: parsed.error.issues },
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
        'Only workspace owners and admins can manage templates.',
        'auth',
      ),
    };
  }

  const { id } = parsed.data;

  // Check template exists and belongs to workspace
  const { data: existing } = await supabase
    .from('report_templates')
    .select('id, client_id')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (!existing) {
    return {
      success: false,
      error: createFlowError(
        404,
        'NOT_FOUND',
        'Template not found.',
        'validation',
      ),
    };
  }

  // If this is workspace default (client_id IS NULL), ensure there is another default available
  if (existing.client_id === null) {
    const { count } = await supabase
      .from('report_templates')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .is('client_id', null)
      .neq('id', id);

    if (!count || count < 1) {
      return {
        success: false,
        error: createFlowError(
          400,
          'DEFAULT_TEMPLATE_REQUIRED',
          'Cannot delete workspace default template without a replacement.',
          'validation',
        ),
      };
    }
  }

  const { error: delErr } = await supabase
    .from('report_templates')
    .delete()
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId);

  if (delErr) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        delErr.message ?? 'Failed to delete template.',
        'system',
      ),
    };
  }

  return { success: true, data: { id } };
}
