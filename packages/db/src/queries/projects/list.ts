import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Project } from './create';

const projectRowSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  client_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

function mapProjectRow(row: Record<string, unknown>): Project {
  const parsed = projectRowSchema.parse(row);
  return {
    id: parsed.id,
    workspaceId: parsed.workspace_id,
    clientId: parsed.client_id,
    name: parsed.name,
    description: parsed.description,
    status: parsed.status,
    archivedAt: parsed.archived_at,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
  };
}

export interface ListProjectsInput {
  workspaceId: string;
  clientId?: string;
}

export async function listProjects(
  supabase: SupabaseClient,
  input: ListProjectsInput,
): Promise<Project[]> {
  let query = supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', input.workspaceId)
    .eq('status', 'active');

  if (input.clientId) {
    query = query.eq('client_id', input.clientId);
  }

  query = query.order('name', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => mapProjectRow(row as Record<string, unknown>));
}
