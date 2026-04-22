import type { SupabaseClient } from '@supabase/supabase-js';

export interface UserWorkspace {
  id: string;
  name: string;
  role: string;
}

export async function listUserWorkspaces(
  client: SupabaseClient,
  userId: string,
): Promise<UserWorkspace[]> {
  const { data, error } = await client
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  if (!data) return [];

  return data
    .filter((row): row is typeof row & { workspaces: { name: string } } => row.workspaces !== null)
    .map((row) => ({
      id: row.workspace_id,
      name: row.workspaces.name,
      role: row.role,
    }));
}
