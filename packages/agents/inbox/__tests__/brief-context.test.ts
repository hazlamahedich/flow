import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMorningBriefContext } from '../brief-context';
import { createServiceClient } from '@flow/db';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

describe('brief-context', () => {
  const workspaceId = 'ws-123';
  
  const resolvedData = { data: null, error: null };
  let pendingResolve: ((value: unknown) => void) | null = null;

  const mockSupabase: any = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    gte: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn().mockImplementation((resolve: (value: unknown) => void) => {
      if (pendingResolve) {
        const r = pendingResolve;
        pendingResolve = null;
        return Promise.resolve(r).then(resolve);
      }
      return Promise.resolve(resolvedData).then(resolve);
    }),
  };

  function queueResolve(data: unknown) {
    pendingResolve = data as ((value: unknown) => void) & { data: unknown };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    pendingResolve = null;
    (createServiceClient as any).mockReturnValue(mockSupabase);
    
    mockSupabase.from.mockImplementation(() => mockSupabase);
    mockSupabase.select.mockImplementation(() => mockSupabase);
    mockSupabase.eq.mockImplementation(() => mockSupabase);
    mockSupabase.order.mockImplementation(() => mockSupabase);
    mockSupabase.limit.mockImplementation(() => mockSupabase);
    mockSupabase.gte.mockImplementation(() => mockSupabase);
    mockSupabase.in.mockImplementation(() => mockSupabase);
    mockSupabase.maybeSingle.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  });

  it('computes since as 24h ago when no previous brief exists', async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null });
    
    const context = await getMorningBriefContext(workspaceId);
    
    const expectedSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(context.since.getTime()).toBeGreaterThan(expectedSince.getTime() - 10000);
  });

  it('aggregates emails by client and identifies threads > 3', async () => {
    const emails = [
      { id: '1', subject: 'Urgent', sender: 'A', thread_id: 't1', client_id: 'c1', clients: { name: 'Client 1' }, email_categorizations: [{ category: 'urgent' }] },
      { id: '2', subject: 'Action', sender: 'A', thread_id: 't1', client_id: 'c1', clients: { name: 'Client 1' }, email_categorizations: [{ category: 'action' }] },
      { id: '3', subject: 'Info', sender: 'A', thread_id: 't1', client_id: 'c1', clients: { name: 'Client 1' }, email_categorizations: [{ category: 'info' }] },
      { id: '4', subject: 'More Info', sender: 'A', thread_id: 't1', client_id: 'c1', clients: { name: 'Client 1' }, email_categorizations: [{ category: 'info' }] },
      { id: '5', subject: 'Client 2', sender: 'B', thread_id: 't2', client_id: 'c2', clients: { name: 'Client 2' }, email_categorizations: [{ category: 'noise' }] },
    ];

    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: { generated_at: '2026-05-04T06:00:00Z' } });
    
    let gteCallCount = 0;
    mockSupabase.gte.mockImplementation(() => {
      gteCallCount++;
      if (gteCallCount === 1) queueResolve({ data: emails });
      if (gteCallCount === 2) queueResolve({ data: [] });
      return mockSupabase;
    });

    let eqCallCount = 0;
    mockSupabase.eq.mockImplementation(() => {
      eqCallCount++;
      if (eqCallCount === 5) return Promise.resolve({ data: [{ id: 'c1' }, { id: 'c2' }] });
      return mockSupabase;
    });

    const context = await getMorningBriefContext(workspaceId);

    expect(context.clientBreakdown).toHaveLength(2);
    expect(context.threadSummaries).toHaveLength(1);
    expect(context.threadSummaries[0]?.emailCount).toBe(4);
  });

  it('enforces cross-client isolation in raw groups', async () => {
    const emails = [
      { id: '1', subject: 'A', sender: 'A', thread_id: 't1', client_id: 'c1', clients: { name: 'C1' }, email_categorizations: [] },
      { id: '2', subject: 'B', sender: 'B', thread_id: 't2', client_id: 'c2', clients: { name: 'C2' }, email_categorizations: [] },
    ];

    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null });

    let gteCallCount = 0;
    mockSupabase.gte.mockImplementation(() => {
      gteCallCount++;
      if (gteCallCount === 1) queueResolve({ data: emails });
      if (gteCallCount === 2) queueResolve({ data: [] });
      return mockSupabase;
    });
    
    let eqCallCount = 0;
    mockSupabase.eq.mockImplementation(() => {
      eqCallCount++;
      if (eqCallCount === 5) return Promise.resolve({ data: [{ id: 'c1' }, { id: 'c2' }] });
      return mockSupabase;
    });

    const context = await getMorningBriefContext(workspaceId);

    const group1 = context.rawGroups.find(g => g.clientId === 'c1');
    const group2 = context.rawGroups.find(g => g.clientId === 'c2');

    expect(group1!.emails).toHaveLength(1);
    expect(group2!.emails).toHaveLength(1);
    expect(group1!.emails[0]?.id).toBe('1');
    expect(group2!.emails[0]?.id).toBe('2');
  });
});
