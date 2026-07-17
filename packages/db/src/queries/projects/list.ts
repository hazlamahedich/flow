import type { SupabaseClient } from '@supabase/supabase-js';
import { mapProjectRow } from './row-schema';
import type { Project } from './create';

export interface ListProjectsInput {
  workspaceId: string;
  clientId?: string;
}

export async function listProjects(
  supabase: SupabaseClient,
  input: ListProjectsInput,
): Promise<Project[]> {
  let query = supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', input.workspaceId)
    .eq('status', 'active');

  if (input.clientId) {
    query = query.eq('client_id', input.clientId);
  }

  query = query.order('name', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) =>
    mapProjectRow(row as Record<string, unknown>),
  );
}
