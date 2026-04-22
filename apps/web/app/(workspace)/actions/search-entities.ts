'use server';

import { SearchInputSchema } from '@flow/types';
import type { ActionResult, SearchResult } from '@flow/types';
import { createFlowError, searchEntities } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';

export async function searchEntitiesAction(
  input: unknown,
): Promise<ActionResult<SearchResult[]>> {
  const parsed = SearchInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        'Invalid search query',
        'validation',
        { issues: parsed.error.issues },
      ),
    };
  }

  const supabase = await getServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      success: false,
      error: createFlowError(401, 'AUTH_REQUIRED', 'Authentication required', 'auth'),
    };
  }

  const workspaceId = user.app_metadata?.workspace_id as string | undefined;
  if (!workspaceId) {
    return {
      success: false,
      error: createFlowError(403, 'TENANT_CONTEXT_MISSING', 'No active workspace', 'auth'),
    };
  }

  try {
    const results = await searchEntities({
      client: supabase,
      workspaceId,
      query: parsed.data.query,
    });

    return { success: true, data: results };
  } catch (error) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Search failed',
        'system',
      ),
    };
  }
}
