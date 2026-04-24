import { createServiceClient } from '../../client';

interface TrustSnapshotInsert {
  workspace_id: string;
  execution_id: string;
  agent_id: string;
  action_type: string;
  matrix_version: number;
  level: 'supervised' | 'confirm' | 'auto';
  score: number;
  snapshot_hash: string;
}

interface TrustSnapshotDbRow extends TrustSnapshotInsert {
  id: string;
  created_at: string;
}

export type { TrustSnapshotDbRow, TrustSnapshotInsert };

export async function insertSnapshot(
  entry: TrustSnapshotInsert,
): Promise<TrustSnapshotDbRow> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('trust_snapshots')
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSnapshotByExecution(
  executionId: string,
): Promise<TrustSnapshotDbRow | null> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('trust_snapshots')
    .select('*')
    .eq('execution_id', executionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
