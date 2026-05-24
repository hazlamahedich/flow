import { z } from 'zod';
import type { Project } from './create';

export const projectRowSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  client_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).strip();

export function mapProjectRow(row: Record<string, unknown>): Project {
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
