import type { SupabaseClient } from '@supabase/supabase-js';
import { timeEntryRowSchema, mapTimeEntryRow } from './row-schema';

export interface CreateTimeEntryInput {
  workspaceId: string;
  clientId: string;
  projectId: string | null;
  userId: string;
  date: string;
  durationMinutes: number;
  startMinutes?: number | null;
  endMinutes?: number | null;
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
  startMinutes: number | null;
  endMinutes: number | null;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
      start_minutes: input.startMinutes ?? null,
      end_minutes: input.endMinutes ?? null,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  const parsed = timeEntryRowSchema.parse(data as Record<string, unknown>);
  return mapTimeEntryRow(parsed, null);
}
