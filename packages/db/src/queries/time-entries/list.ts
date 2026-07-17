import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { timeEntryRowSchema, mapTimeEntryRow } from './row-schema';
import type { TimeEntry } from './create';

const listRowSchema = timeEntryRowSchema.extend({
  projects: z.object({ name: z.string() }).nullable().optional(),
});

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

  const { data, error, count } = await query.range(
    offset,
    offset + pageSize - 1,
  );
  if (error) throw error;

  const items = (data ?? []).map((row) => {
    const parsed = listRowSchema.parse(row as Record<string, unknown>);
    return mapTimeEntryRow(parsed, parsed.projects?.name ?? null);
  });
  const total = count ?? 0;
  return {
    items,
    total,
    page,
    pageSize,
    hasNextPage: offset + pageSize < total,
  };
}
