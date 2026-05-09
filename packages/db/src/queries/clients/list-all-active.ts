import type { SupabaseClient } from '@supabase/supabase-js';

export interface ActiveClientSummary {
  id: string;
  name: string;
}

/**
 * Fetches all active clients for a workspace without pagination.
 * Used for select dropdowns where the full list is needed upfront.
 * Members are pre-filtered by RLS; no app-layer access check required.
 */
export async function listAllActiveClients(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<ActiveClientSummary[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ActiveClientSummary[];
}
