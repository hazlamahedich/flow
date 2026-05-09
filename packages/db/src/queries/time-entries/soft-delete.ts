import type { SupabaseClient } from '@supabase/supabase-js';

export interface SoftDeleteTimeEntryInput {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
}

export async function softDeleteTimeEntry(
  supabase: SupabaseClient,
  input: SoftDeleteTimeEntryInput,
): Promise<boolean> {
  let query = supabase
    .from('time_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('workspace_id', input.workspaceId)
    .is('deleted_at', null);

  if (input.role === 'member') {
    query = query.eq('user_id', input.userId);
  }

  const { error } = await query;
  if (error) throw error;
  return true;
}
