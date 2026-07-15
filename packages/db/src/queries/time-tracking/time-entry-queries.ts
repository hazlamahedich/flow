import type { SupabaseClient } from '@supabase/supabase-js';

export interface UpdateTimeEntryInput {
  id: string;
  workspaceId: string;
  date?: string;
  durationMinutes?: number;
  startMinutes?: number | null;
  endMinutes?: number | null;
  clientId?: string;
  projectId?: string | null;
  notes?: string | null;
}

export interface UpdateTimeEntryResult {
  id: string;
  updatedAt: string;
}

export async function updateTimeEntry(
  supabase: SupabaseClient,
  input: UpdateTimeEntryInput,
): Promise<UpdateTimeEntryResult> {
  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.date !== undefined) updateFields.date = input.date;
  if (input.durationMinutes !== undefined)
    updateFields.duration_minutes = input.durationMinutes;
  if (input.startMinutes !== undefined)
    updateFields.start_minutes = input.startMinutes;
  if (input.endMinutes !== undefined)
    updateFields.end_minutes = input.endMinutes;
  if (input.clientId !== undefined) updateFields.client_id = input.clientId;
  if (input.projectId !== undefined) updateFields.project_id = input.projectId;
  if (input.notes !== undefined) updateFields.notes = input.notes;

  const { data, error } = await supabase
    .from('time_entries')
    .update(updateFields)
    .eq('id', input.id)
    .eq('workspace_id', input.workspaceId)
    .is('deleted_at', null)
    .select('id, updated_at')
    .single();

  if (error) throw error;
  if (!data) throw new Error('NOT_FOUND');

  return {
    id: data.id as string,
    updatedAt: data.updated_at as string,
  };
}

export interface InsertEditHistoryInput {
  timeEntryId: string;
  previousValues: Record<string, unknown>;
  changedBy: string;
  editReason?: string | null;
}

export async function insertEditHistory(
  supabase: SupabaseClient,
  input: InsertEditHistoryInput,
): Promise<void> {
  const { error } = await supabase.from('time_entry_edit_history').insert({
    time_entry_id: input.timeEntryId,
    previous_values: input.previousValues,
    changed_by: input.changedBy,
    edit_reason: input.editReason ?? null,
  });

  if (error) throw error;
}

export interface GetTimeEntryForUpdateInput {
  id: string;
  workspaceId: string;
}

export interface TimeEntryCurrentValues {
  id: string;
  date: string;
  durationMinutes: number;
  startMinutes: number | null;
  endMinutes: number | null;
  clientId: string;
  projectId: string | null;
  notes: string | null;
  deletedAt: string | null;
  userId: string;
}

export async function getTimeEntryForUpdate(
  supabase: SupabaseClient,
  input: GetTimeEntryForUpdateInput,
): Promise<TimeEntryCurrentValues | null> {
  const { data, error } = await supabase
    .from('time_entries')
    .select(
      'id, date, duration_minutes, start_minutes, end_minutes, client_id, project_id, notes, deleted_at, user_id',
    )
    .eq('id', input.id)
    .eq('workspace_id', input.workspaceId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    date: row.date as string,
    durationMinutes: row.duration_minutes as number,
    startMinutes: row.start_minutes as number | null,
    endMinutes: row.end_minutes as number | null,
    clientId: row.client_id as string,
    projectId: row.project_id as string | null,
    notes: row.notes as string | null,
    deletedAt: row.deleted_at as string | null,
    userId: row.user_id as string,
  };
}
