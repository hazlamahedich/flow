'use server';

import { createWorkspaceSchema } from '@flow/types';
import type { ActionResult, Workspace } from '@flow/types';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, cacheTag } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { generateSlug, mapWorkspaceRow, type WorkspaceRow } from '@/lib/workspace-utils';

const MAX_SLUG_RETRIES = 3;

export async function createWorkspace(
  input: unknown,
): Promise<ActionResult<Workspace>> {
  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
    };
  }

  const { name } = parsed.data;
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  let lastError: string | null = null;

  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const slug = generateSlug(name);

    const { data: row, error: wsError } = await supabase
      .rpc('create_workspace', {
        p_name: name,
        p_slug: slug,
        p_owner_id: ctx.userId,
      })
      .single();

    if (wsError) {
      if (wsError.code === '23505') {
        lastError = wsError.message;
        continue;
      }
      return {
        success: false,
        error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to create workspace', 'system'),
      };
    }

    revalidateTag(cacheTag('workspace_member', (row as WorkspaceRow).id));
    revalidateTag(cacheTag('workspace', (row as WorkspaceRow).id));
    return { success: true, data: mapWorkspaceRow(row as unknown as WorkspaceRow) };
  }

  return {
    success: false,
    error: createFlowError(500, 'WORKSPACE_SLUG_COLLISION', `Failed to create workspace after ${MAX_SLUG_RETRIES} attempts: ${lastError}`, 'system'),
  };
}
