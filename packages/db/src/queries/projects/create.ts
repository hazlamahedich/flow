import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

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

export interface Project {
  id: string;
  workspaceId: string;
  clientId: string;
  name: string;
  description: string | null;
  status: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

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

export class ProjectNameDuplicateError extends Error {
  constructor() {
    super('A project with this name already exists for this client');
    this.name = 'ProjectNameDuplicateError';
  }
}

export interface CreateProjectInput {
  workspaceId: string;
  clientId: string;
  name: string;
}

export async function createProject(
  supabase: SupabaseClient,
  input: CreateProjectInput,
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: input.workspaceId,
      client_id: input.clientId,
      name: input.name,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new ProjectNameDuplicateError();
    }
    throw error;
  }

  return mapProjectRow(data as Record<string, unknown>);
}
