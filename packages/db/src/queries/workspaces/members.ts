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

/**
 * Count **active, non-expired** workspace_members for tier-limit enforcement
 * (Story 9.4 AC2, EC11).
 *
 * Mirrors `getActiveMembership`'s active+not-expired rule: pending
 * invitations do NOT consume seats (those are `workspace_invitations`, a
 * separate table). An expired-but-still-active row is also excluded so a
 * member who let their session lapse doesn't block a new invite.
 *
 * User-scoped (accepts the caller's SupabaseClient — RLS applies). Never
 * `service_role`: this is consumed by `enforceTierLimit`, a user-facing
 * path (project-context.md:150).
 */
export async function countActiveTeamMembers(
  client: SupabaseClient,
  workspaceId: string,
): Promise<number> {
  const nowIso = new Date().toISOString();
  const { count, error } = await client
    .from('workspace_members')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  if (error) throw error;
  return count ?? 0;
}
