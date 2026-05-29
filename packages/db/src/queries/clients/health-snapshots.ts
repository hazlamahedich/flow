import type { SupabaseClient } from '@supabase/supabase-js';

export interface ClientHealthSnapshot {
  id: string;
  workspace_id: string;
  client_id: string;
  snapshot_date: string;
  engagement_score: number;
  payment_score: number;
  communication_score: number;
  overall_health: string;
  indicators: Record<string, unknown>;
  created_at: string;
}

export async function getClientHealthSnapshots(
  client: SupabaseClient,
  workspaceId: string,
  clientIds: string[],
): Promise<Map<string, ClientHealthSnapshot>> {
  if (clientIds.length === 0) return new Map();

  const { data, error } = await client
    .from('client_health_snapshots')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('client_id', clientIds)
    .order('snapshot_date', { ascending: false });

  if (error) return new Map();

  const latestByClient = new Map<string, ClientHealthSnapshot>();
  for (const row of data ?? []) {
    if (!latestByClient.has(row.client_id)) {
      latestByClient.set(row.client_id, row as ClientHealthSnapshot);
    }
  }

  return latestByClient;
}
