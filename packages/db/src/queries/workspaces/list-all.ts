import type { SupabaseClient } from '@supabase/supabase-js';

export async function listAllWorkspaces(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('workspaces').select('id, name');

  if (error) throw error;
  return data;
}
