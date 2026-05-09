import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { TimeEntry } from './create';

const timeEntryRowSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  client_id: z.string(),
  user_id: z.string(),
  project_id: z.string().nullable(),
  projects: z.object({ name: z.string() }).nullable().optional(),
  date: z.string(),
  duration_minutes: z.number(),
  notes: z.string().nullable(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

export interface TimeEntryFilters {
  clientId?: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
}

export interface ListTimeEntriesInput {
  workspaceId: string;
  userId: string;
  role: string;
  filters: TimeEntryFilters;
  page?: number;
  pageSize?: number;
}

export interface ListTimeEntriesResult {
  items: TimeEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

function mapTimeEntryRow(row: Record<string, unknown>): TimeEntry {
  const parsed = timeEntryRowSchema.parse(row);
  return {
    id: parsed.id,
    workspaceId: parsed.workspace_id,
    clientId: parsed.client_id,
    userId: parsed.user_id,
    projectId: parsed.project_id,
    projectName: parsed.projects?.name ?? null,
    date: parsed.date,
    durationMinutes: parsed.duration_minutes,
    notes: parsed.notes,
    deletedAt: parsed.deleted_at,
    createdAt: parsed.created_at,
    updatedAt: parsed.updated_at,
  };
}

export async function listTimeEntries(
  supabase: SupabaseClient,
  input: ListTimeEntriesInput,
): Promise<ListTimeEntriesResult> {
  const { workspaceId, role, filters, userId } = input;
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 25;
  const offset = (page - 1) * pageSize;

  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    return { items: [], total: 0, page, pageSize, hasNextPage: false };
  }

  let query = supabase
    .from('time_entries')
    .select('*, projects:project_id(name)', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null);

  if (role !== 'owner' && role !== 'admin') {
    const { data: accessRows, error: accessError } = await supabase
      .from('member_client_access')
      .select('client_id')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .is('revoked_at', null);

    if (accessError) throw accessError;

    const clientIds = (accessRows ?? []).map((r) => r.client_id as string);
    if (clientIds.length === 0) {
      return { items: [], total: 0, page, pageSize, hasNextPage: false };
    }
    // Cap at 500 to avoid URL-length limits in PostgREST; workspaces with more
    // accessible clients than this are expected to be exceedingly rare.
    const cappedIds = clientIds.slice(0, 500);
    query = query.in('client_id', cappedIds);
  }

  if (filters.clientId) query = query.eq('client_id', filters.clientId);
  if (filters.projectId) query = query.eq('project_id', filters.projectId);
  if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('date', filters.dateTo);
  if (filters.userId) query = query.eq('user_id', filters.userId);

  query = query
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  const { data, error, count } = await query.range(offset, offset + pageSize - 1);
  if (error) throw error;

  const items = (data ?? []).map((row) => mapTimeEntryRow(row as Record<string, unknown>));
  const total = count ?? 0;
  return { items, total, page, pageSize, hasNextPage: offset + pageSize < total };
}
