import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client } from '@flow/types';

export const clientRowSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  company_name: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  billing_email: z.string().nullable(),
  hourly_rate_cents: z.number().nullable(),
  status: z.enum(['active', 'archived']),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export function mapClientRow(raw: Record<string, unknown>): Client {
  const row = clientRowSchema.parse(raw);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    companyName: row.company_name,
    address: row.address,
    notes: row.notes,
    billingEmail: row.billing_email,
    hourlyRateCents: row.hourly_rate_cents,
    status: row.status as 'active' | 'archived',
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function countActiveClients(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');
  if (error) throw error;
  return count ?? 0;
}

export async function checkDuplicateEmail(
  supabase: SupabaseClient,
  workspaceId: string,
  email: string,
): Promise<Client | null> {
  const escaped = email.replace(/[%_\\]/g, '\\$&');
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('workspace_id', workspaceId)
    .ilike('email', escaped)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapClientRow(data);
}

export async function hasActiveAgentRuns(
  supabase: SupabaseClient,
  clientId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from('agent_runs')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .in('status', ['queued', 'running', 'waiting_approval']);
  if (error) throw error;
  return (count ?? 0) > 0;
}
