import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client, ClientListFilters } from '@flow/types';
import { mapClientRow } from './crud-helpers';

export { countActiveClients, checkDuplicateEmail, hasActiveAgentRuns } from './crud-helpers';

interface ClientIdInput {
  clientId: string;
  workspaceId: string;
}

interface GetClientByIdInput {
  clientId: string;
  workspaceId: string;
}

export async function getClientById(
  client: SupabaseClient,
  input: GetClientByIdInput,
): Promise<Client | null> {
  const { data, error } = await client
    .from('clients')
    .select('*')
    .eq('id', input.clientId)
    .eq('workspace_id', input.workspaceId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapClientRow(data);
}

interface ListClientsInput {
  workspaceId: string;
  userId: string;
  role: string;
  filters: ClientListFilters;
}

export async function listClients(
  supabase: SupabaseClient,
  input: ListClientsInput,
): Promise<{ items: Client[]; total: number; page: number; pageSize: number; hasNextPage: boolean }> {
  const { workspaceId, role, filters } = input;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const offset = (page - 1) * pageSize;
  const sortBy = filters.sortBy ?? 'created_at';
  const sortOrder = filters.sortOrder ?? 'desc';

  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId);

  if (role === 'member') {
    const { data: accessRows, error: accessError } = await supabase
      .from('member_client_access')
      .select('client_id')
      .eq('user_id', input.userId)
      .eq('workspace_id', workspaceId)
      .is('revoked_at', null);

    if (accessError) throw accessError;

    const clientIds = (accessRows ?? []).map((r) => r.client_id as string);
    if (clientIds.length === 0) {
      return { items: [], total: 0, page, pageSize, hasNextPage: false };
    }
    query = query.in('id', clientIds);
  }

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.search) {
    const escaped = filters.search.replace(/[%_\\]/g, '\\$&');
    const term = `%${escaped}%`;
    query = query.or(`name.ilike.${term},company_name.ilike.${term}`);
  }

  if (sortBy === 'name') {
    query = query.order('name', { ascending: sortOrder === 'asc' }).order('id', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: sortOrder === 'asc' }).order('id', { ascending: false });
  }

  const { data, error, count } = await query.range(offset, offset + pageSize - 1);
  if (error) throw error;

  const items = (data ?? []).map(mapClientRow);
  const total = count ?? 0;
  return { items, total, page, pageSize, hasNextPage: offset + pageSize < total };
}

interface InsertClientInput {
  workspaceId: string;
  data: {
    name: string;
    email?: string | null;
    phone?: string | null;
    companyName?: string | null;
    address?: string | null;
    notes?: string | null;
    billingEmail?: string | null;
    hourlyRateCents?: number | null;
  };
}

export async function insertClient(
  client: SupabaseClient,
  input: InsertClientInput,
): Promise<Client> {
  const { data, error } = await client
    .from('clients')
    .insert({
      workspace_id: input.workspaceId,
      name: input.data.name,
      email: input.data.email || null,
      phone: input.data.phone || null,
      company_name: input.data.companyName || null,
      address: input.data.address || null,
      notes: input.data.notes || null,
      billing_email: input.data.billingEmail || null,
      hourly_rate_cents: input.data.hourlyRateCents ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapClientRow(data);
}

interface UpdateClientInput {
  clientId: string;
  workspaceId: string;
  data: Record<string, unknown>;
}

const FIELD_MAP: Record<string, string> = {
  name: 'name', email: 'email', phone: 'phone',
  company_name: 'company_name', address: 'address',
  notes: 'notes', billing_email: 'billing_email',
  hourly_rate_cents: 'hourly_rate_cents',
};

export async function updateClient(
  supabase: SupabaseClient,
  input: UpdateClientInput,
): Promise<Client> {
  const updates: Record<string, unknown> = {};

  for (const [key, dbField] of Object.entries(FIELD_MAP)) {
    if (key in input.data) {
      const value = input.data[key];
      if (dbField === 'hourly_rate_cents') {
        updates[dbField] = value as number | null;
      } else if (typeof value === 'string' && value === '') {
        updates[dbField] = null;
      } else {
        updates[dbField] = value;
      }
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', input.clientId)
    .eq('workspace_id', input.workspaceId)
    .select('*')
    .single();

  if (error) throw error;
  return mapClientRow(data);
}

export async function archiveClient(
  supabase: SupabaseClient,
  input: ClientIdInput,
): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', input.clientId)
    .eq('workspace_id', input.workspaceId)
    .eq('status', 'active')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapClientRow(data);
}

export async function restoreClient(
  supabase: SupabaseClient,
  input: ClientIdInput,
): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .update({ status: 'active', archived_at: null })
    .eq('id', input.clientId)
    .eq('workspace_id', input.workspaceId)
    .eq('status', 'archived')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapClientRow(data);
}
