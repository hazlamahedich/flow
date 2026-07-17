'use server';

import type { ActionResult } from '@flow/types';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
// Type lives in a sibling non-'use server' module because Next.js 15
// forbids exporting non-function values from 'use server' files.
import type { WorkspaceMemberSummary } from './schemas';

export async function listWorkspaceMembersAction(): Promise<
  ActionResult<WorkspaceMemberSummary[]>
> {
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  try {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('user_id, users(name, email)')
      .eq('workspace_id', ctx.workspaceId)
      .eq('status', 'active');

    if (error) throw error;

    const members: WorkspaceMemberSummary[] = (data ?? [])
      .map((row) => {
        const user = row.users as unknown as {
          name: string | null;
          email: string | null;
        } | null;
        return {
          userId: row.user_id as string,
          displayName: user?.name ?? user?.email ?? (row.user_id as string),
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return { success: true, data: members };
  } catch {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to load team members',
        'system',
      ),
    };
  }
}
