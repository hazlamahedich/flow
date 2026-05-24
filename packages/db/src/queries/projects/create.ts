import type { SupabaseClient } from '@supabase/supabase-js';
import { mapProjectRow } from './row-schema';

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
