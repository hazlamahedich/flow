import { describe, it, expect, vi } from 'vitest';
import { searchEntities } from './search-entities';

function mockClient(tableResults: Record<string, { data?: unknown[]; error?: unknown }>) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      const result = tableResults[table] ?? { data: [], error: null };
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(result),
      };
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

describe('searchEntities', () => {
  it('[P0] returns combined results from all tables', async () => {
    const client = mockClient({
      clients: { data: [{ id: 'c-1', name: 'Acme Corp' }] },
      invoices: { data: [{ id: 'i-1', invoice_number: 'INV-001', status: 'paid' }] },
      time_entries: { data: [{ id: 't-1', description: 'Development work' }] },
    });

    const results = await searchEntities({
      client,
      workspaceId: 'ws-1',
      query: 'acme',
    });

    expect(results).toHaveLength(3);
    expect(results[0]!.type).toBe('client');
    expect(results[1]!.type).toBe('invoice');
    expect(results[2]!.type).toBe('time_entry');
  });

  it('[P0] returns empty when all tables fail', async () => {
    const client = mockClient({
      clients: { error: { code: '42P01' } },
      invoices: { error: { code: '42P01' } },
      time_entries: { error: { code: '42P01' } },
    });

    const results = await searchEntities({
      client,
      workspaceId: 'ws-1',
      query: 'test',
    });

    expect(results).toEqual([]);
  });

  it('[P0] escapes special characters in query', async () => {
    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockImplementation((_col: string, pattern: string) => {
        expect(pattern).not.toContain('%');
        expect(pattern).not.toContain('_');
        return { limit: vi.fn().mockResolvedValue({ data: [] }) };
      }),
      limit: vi.fn().mockResolvedValue({ data: [] }),
    });

    const client = { from: fromMock } as unknown as import('@supabase/supabase-js').SupabaseClient;

    await searchEntities({
      client,
      workspaceId: 'ws-1',
      query: '100%_test',
    });
  });

  it('[P1] continues when one table fails but others succeed', async () => {
    const client = mockClient({
      clients: { data: [{ id: 'c-1', name: 'Acme' }] },
      invoices: { error: new Error('table missing') },
      time_entries: { data: [] },
    });

    const results = await searchEntities({
      client,
      workspaceId: 'ws-1',
      query: 'acme',
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.type).toBe('client');
  });
});
