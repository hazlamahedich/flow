'use server';

import type { ActionResult } from '@flow/types';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';

export async function listClientsForTimerAction(): Promise<
  ActionResult<{ id: string; name: string }[]>
> {
  const supabase = await getServerSupabase();

  try {
    const ctx = await requireTenantContext(supabase);

    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .eq('workspace_id', ctx.workspaceId)
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (error) throw error;

    return {
      success: true,
      data: (data ?? []).map((c) => ({
        id: c.id as string,
        name: c.name as string,
      })),
    };
  } catch {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to load clients',
        'system',
      ),
    };
  }
}
