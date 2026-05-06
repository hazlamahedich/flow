import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClientInbox } from '@flow/types';

export const clientInboxRowSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  client_id: z.string(),
  provider: z.string(),
  email_address: z.string(),
  access_type: z.enum(['direct', 'delegated', 'service_account']),
  oauth_state: z.record(z.string(), z.unknown()),
  sync_status: z.enum(['connected', 'syncing', 'error', 'disconnected']),
  sync_cursor: z.string().nullable(),
  error_message: z.string().nullable(),
  last_sync_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export function mapClientInboxRow(raw: Record<string, unknown>): ClientInbox {
  const row = clientInboxRowSchema.parse(raw);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    clientId: row.client_id,
    provider: row.provider,
    emailAddress: row.email_address,
    accessType: row.access_type,
    syncStatus: row.sync_status,
    syncCursor: row.sync_cursor,
    errorMessage: row.error_message,
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface CreateClientInboxInput {
  workspaceId: string;
  clientId: string;
  provider: string;
  emailAddress: string;
  accessType: string;
  oauthState: Record<string, unknown>;
  syncStatus: string;
}

export async function createClientInbox(
  supabase: SupabaseClient,
  input: CreateClientInboxInput,
): Promise<ClientInbox> {
  const { data, error } = await supabase
    .from('client_inboxes')
    .insert({
      workspace_id: input.workspaceId,
      client_id: input.clientId,
      provider: input.provider,
      email_address: input.emailAddress,
      access_type: input.accessType,
      oauth_state: input.oauthState,
      sync_status: input.syncStatus,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapClientInboxRow(data);
}

export async function getClientInboxes(
  supabase: SupabaseClient,
  workspaceId: string,
  clientId: string,
): Promise<ClientInbox[]> {
  const { data, error } = await supabase
    .from('client_inboxes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapClientInboxRow);
}

export async function getClientInboxById(
  supabase: SupabaseClient,
  inboxId: string,
  workspaceId: string,
): Promise<ClientInbox | null> {
  const { data, error } = await supabase
    .from('client_inboxes')
    .select('*')
    .eq('id', inboxId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapClientInboxRow(data);
}

export async function getClientInboxByEmail(
  supabase: SupabaseClient,
  workspaceId: string,
  emailAddress: string,
): Promise<ClientInbox | null> {
  const { data, error } = await supabase
    .from('client_inboxes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('email_address', emailAddress)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapClientInboxRow(data);
}

export async function updateClientInboxSyncStatus(
  supabase: SupabaseClient,
  inboxId: string,
  workspaceId: string,
  syncStatus: string,
  extras?: { syncCursor?: string; errorMessage?: string | null; lastSyncAt?: string },
): Promise<ClientInbox | null> {
  const updates: Record<string, unknown> = { sync_status: syncStatus };
  if (extras?.syncCursor !== undefined) updates.sync_cursor = extras.syncCursor;
  if (extras?.errorMessage !== undefined) updates.error_message = extras.errorMessage;
  if (extras?.lastSyncAt !== undefined) updates.last_sync_at = extras.lastSyncAt;

  const { data, error } = await supabase
    .from('client_inboxes')
    .update(updates)
    .eq('id', inboxId)
    .eq('workspace_id', workspaceId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapClientInboxRow(data);
}

export async function updateClientInboxOAuthState(
  supabase: SupabaseClient,
  inboxId: string,
  workspaceId: string,
  oauthState: Record<string, unknown>,
): Promise<ClientInbox | null> {
  const { data, error } = await supabase
    .from('client_inboxes')
    .update({ oauth_state: oauthState })
    .eq('id', inboxId)
    .eq('workspace_id', workspaceId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapClientInboxRow(data);
}

export async function getConnectedInboxes(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<ClientInbox[]> {
  const { data, error } = await supabase
    .from('client_inboxes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('sync_status', ['connected', 'syncing']);

  if (error) throw error;
  return (data ?? []).map(mapClientInboxRow);
}

export async function clearClientInboxTokens(
  supabase: SupabaseClient,
  inboxId: string,
  workspaceId: string,
): Promise<ClientInbox | null> {
  const { data, error } = await supabase
    .from('client_inboxes')
    .update({ oauth_state: {}, sync_status: 'disconnected', sync_cursor: null })
    .eq('id', inboxId)
    .eq('workspace_id', workspaceId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapClientInboxRow(data);
}
