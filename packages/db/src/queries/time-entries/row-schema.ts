import { z } from 'zod';
import type { TimeEntry } from './create';

export const timeEntryRowSchema = z
  .object({
    id: z.string(),
    workspace_id: z.string(),
    client_id: z.string(),
    user_id: z.string(),
    project_id: z.string().nullable(),
    date: z.string(),
    duration_minutes: z.number(),
    start_minutes: z.number().nullable(),
    end_minutes: z.number().nullable(),
    notes: z.string().nullable(),
    deleted_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strip();

export function mapTimeEntryRow(
  parsed: z.infer<typeof timeEntryRowSchema>,
  projectName: string | null,
): TimeEntry {
  return {
    id: parsed.id,
    workspaceId: parsed.workspace_id,
    clientId: parsed.client_id,
    userId: parsed.user_id,
    projectId: parsed.project_id,
    projectName,
    date: parsed.date,
    durationMinutes: parsed.duration_minutes,
    startMinutes: parsed.start_minutes,
    endMinutes: parsed.end_minutes,
    notes: parsed.notes,
    deletedAt: parsed.deleted_at,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
  };
}
