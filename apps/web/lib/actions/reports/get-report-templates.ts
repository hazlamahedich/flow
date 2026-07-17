'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import type { ActionResult, TemplateListItem } from '@flow/types';

export async function getReportTemplatesForWorkspaceAction(): Promise<
  ActionResult<{ items: TemplateListItem[] }>
> {
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

  const { data, error } = await supabase
    .from('report_templates')
    .select('id, client_id, name, sections_config, branding, updated_at')
    .eq('workspace_id', ctx.workspaceId)
    .order('updated_at', { ascending: false });

  if (error) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to load templates.',
        'system',
      ),
    };
  }

  const items: TemplateListItem[] = (data ?? []).map(
    (row: Record<string, unknown>) => ({
      id: row.id as string,
      clientId: (row.client_id as string | null) ?? null,
      name: row.name as string,
      sectionsConfig: (row.sections_config as Record<string, unknown>) ?? {},
      branding: (row.branding as Record<string, unknown>) ?? {},
      updatedAt: String(row.updated_at),
    }),
  );

  return { success: true, data: { items } };
}
