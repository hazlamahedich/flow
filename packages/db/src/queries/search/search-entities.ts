import type { SupabaseClient } from '@supabase/supabase-js';
import type { SearchResult } from '@flow/types';

export interface SearchEntitiesOptions {
  client: SupabaseClient;
  workspaceId: string;
  query: string;
  signal?: AbortSignal;
  limit?: number;
}

async function searchTable(
  client: SupabaseClient,
  table: string,
  workspaceId: string,
  query: string,
  type: SearchResult['type'],
  labelColumn: string,
  hrefPrefix: string,
  descriptionColumn?: string,
  limit: number = 10,
): Promise<SearchResult[]> {
  const selectColumns = descriptionColumn
    ? `id, ${labelColumn}, ${descriptionColumn}`
    : `id, ${labelColumn}`;

  const escaped = query.replace(/[%_]/g, '\\$&');

  const { data, error } = await client
    .from(table)
    .select(selectColumns)
    .eq('workspace_id', workspaceId)
    .ilike(labelColumn, `%${escaped}%`)
    .limit(limit);

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  if (!data) return [];

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    type,
    label: row[labelColumn] as string,
    description: descriptionColumn ? (row[descriptionColumn] as string | undefined) : undefined,
    href: `${hrefPrefix}/${row.id}`,
  }));
}

export async function searchEntities(
  options: SearchEntitiesOptions,
): Promise<SearchResult[]> {
  const { client, workspaceId, query, limit = 5 } = options;

  const [clients, invoices, timeEntries] = await Promise.allSettled([
    searchTable(client, 'clients', workspaceId, query, 'client', 'name', '/clients', undefined, limit),
    searchTable(client, 'invoices', workspaceId, query, 'invoice', 'invoice_number', '/invoices', 'status', limit),
    searchTable(client, 'time_entries', workspaceId, query, 'time_entry', 'description', '/time', undefined, limit),
  ]);

  const results: SearchResult[] = [];

  for (const result of [clients, invoices, timeEntries]) {
    if (result.status === 'fulfilled') {
      results.push(...result.value);
    }
  }

  return results;
}
