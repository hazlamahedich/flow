import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const memberAccessRowSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  user_id: z.string(),
  client_id: z.string(),
  granted_by: z.string(),
  granted_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
}).passthrough();

interface AssignMemberInput {
  workspaceId: string;
  userId: string;
  clientId: string;
  grantedBy: string;
}

export async function assignMemberToClient(
  client: SupabaseClient,
  input: AssignMemberInput,
): Promise<void> {
  const { error } = await client
    .from('member_client_access')
    .upsert(
      {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        client_id: input.clientId,
        granted_by: input.grantedBy,
        revoked_at: null,
      },
      { onConflict: 'workspace_id,user_id,client_id' },
    );

  if (error) throw error;
}

interface RevokeMemberInput {
  workspaceId: string;
  userId: string;
  clientId: string;
}

export async function revokeMemberAccess(
  client: SupabaseClient,
  input: RevokeMemberInput,
): Promise<number> {
  const { error, count } = await client
    .from('member_client_access')
    .update({ revoked_at: new Date().toISOString() }, { count: 'exact' })
    .eq('workspace_id', input.workspaceId)
    .eq('user_id', input.userId)
    .eq('client_id', input.clientId)
    .is('revoked_at', null);

  if (error) throw error;
  return count ?? 0;
}

interface GetMembersForClientInput {
  clientId: string;
  workspaceId: string;
}

interface MemberAccessRow {
  id: string;
  userId: string;
  grantedBy: string;
  grantedAt: string | null;
  revokedAt: string | null;
}

export async function getMembersForClient(
  client: SupabaseClient,
  input: GetMembersForClientInput,
): Promise<MemberAccessRow[]> {
  const { data, error } = await client
    .from('member_client_access')
    .select('id, user_id, granted_by, granted_at, revoked_at')
    .eq('client_id', input.clientId)
    .eq('workspace_id', input.workspaceId)
    .is('revoked_at', null)
    .order('granted_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const parsed = memberAccessRowSchema.parse(row);
    return {
      id: parsed.id,
      userId: parsed.user_id,
      grantedBy: parsed.granted_by,
      grantedAt: parsed.granted_at,
      revokedAt: parsed.revoked_at,
    };
  });
}

interface GetClientsForMemberInput {
  userId: string;
  workspaceId: string;
}

export async function getClientsForMember(
  client: SupabaseClient,
  input: GetClientsForMemberInput,
): Promise<string[]> {
  const { data, error } = await client
    .from('member_client_access')
    .select('client_id')
    .eq('user_id', input.userId)
    .eq('workspace_id', input.workspaceId)
    .is('revoked_at', null);

  if (error) throw error;

  return (data ?? []).map((row) => row.client_id as string);
}
