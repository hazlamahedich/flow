import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const timeEntryRowSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  client_id: z.string(),
  user_id: z.string(),
  project_id: z.string().nullable(),
  date: z.string(),
  duration_minutes: z.number(),
  notes: z.string().nullable(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

export interface CreateTimeEntryInput {
  workspaceId: string;
  clientId: string;
  projectId: string | null;
  userId: string;
  date: string;
  durationMinutes: number;
  notes?: string | null;
}

export interface TimeEntry {
  id: string;
  workspaceId: string;
  clientId: string;
  userId: string;
  projectId: string | null;
  projectName: string | null;
  date: string;
  durationMinutes: number;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapTimeEntryRow(row: Record<string, unknown>): TimeEntry {
  const parsed = timeEntryRowSchema.parse(row);
  return {
    id: parsed.id,
    workspaceId: parsed.workspace_id,
    clientId: parsed.client_id,
    userId: parsed.user_id,
    projectId: parsed.project_id,
    projectName: null,
    date: parsed.date,
    durationMinutes: parsed.duration_minutes,
    notes: parsed.notes,
    deletedAt: parsed.deleted_at,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
  };
}

export async function createTimeEntry(
  supabase: SupabaseClient,
  input: CreateTimeEntryInput,
): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      workspace_id: input.workspaceId,
      client_id: input.clientId,
      project_id: input.projectId ?? null,
      user_id: input.userId,
      date: input.date,
      duration_minutes: input.durationMinutes,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapTimeEntryRow(data as Record<string, unknown>);
}
