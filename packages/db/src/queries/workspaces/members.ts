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
