import type { SupabaseClient } from '@supabase/supabase-js';

interface ActiveMembership {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  status: string;
  expiresAt: string | null;
}

export async function getActiveMembership(
  client: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<ActiveMembership | null> {
  const { data } = await client
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, status, expires_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!data) return null;

  // TODO(pg-boss): nightly expiry cleanup job
  if (data.expires_at && new Date(data.expires_at) <= new Date()) {
    return null;
  }

  return {
    id: data.id,
    workspaceId: data.workspace_id,
    userId: data.user_id,
    role: data.role,
    status: data.status,
    expiresAt: data.expires_at,
  };
}

export async function getAccessibleClients(
  client: SupabaseClient,
  workspaceId: string,
  userId: string,
  role: string,
): Promise<Array<{ id: string; name: string }>> {
  if (role === 'owner' || role === 'admin') {
    const { data } = await client
      .from('clients')
      .select('id, name')
      .eq('workspace_id', workspaceId);
    return (data ?? []) as Array<{ id: string; name: string }>;
  }

  const { data } = await client
    .from('member_client_access')
    .select('client_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .is('revoked_at', null);

  if (!data || data.length === 0) return [];

  const clientIds = data.map((row) => row.client_id);

  const { data: clients } = await client
    .from('clients')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .in('id', clientIds);

  return (clients ?? []) as Array<{ id: string; name: string }>;
}
