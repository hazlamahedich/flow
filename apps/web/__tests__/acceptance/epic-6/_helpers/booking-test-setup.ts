import { vi } from 'vitest';

export const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
export const CLIENT_ID = '00000000-0000-4000-8000-000000000002';
export const REQ_ID = '00000000-0000-4000-8000-000000000020';
export const EMAIL_ID = '00000000-0000-4000-8000-000000000099';
export const CAL_DB_ID = '00000000-0000-4000-8000-000000000003';
export const SIGNAL_ID = '00000000-0000-4000-8000-000000000010';

export type CapturedOps = {
  _capturedInserts: Array<{ table: string; data: unknown }>;
  _capturedUpdates: Array<{
    table: string;
    data: unknown;
    filters: Record<string, unknown>;
  }>;
};

type MockFn = ReturnType<typeof vi.fn>;

export function createBookingMockSupabase(
  opts: {
    requestData?: Record<string, unknown> | null;
    requestError?: unknown;
    noCalendars?: boolean;
    eventInsertError?: string | null;
    signalData?: Array<{ id: string }> | null;
    noClients?: boolean;
    existingRequest?: boolean;
    insertError?: { code?: string; message: string } | null;
  } = {},
): InstanceType<(typeof import('@supabase/supabase-js'))['SupabaseClient']> &
  CapturedOps {
  let capturedInsertData: Record<string, unknown> | null = null;
  const capturedInserts: Array<{ table: string; data: unknown }> = [];
  const capturedUpdates: Array<{
    table: string;
    data: unknown;
    filters: Record<string, unknown>;
  }> = [];

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'scheduling_requests') {
      const defaultRequest = {
        id: REQ_ID,
        workspace_id: WORKSPACE_ID,
        client_id: CLIENT_ID,
        status: 'pending',
        duration_minutes: 30,
        preferences: {},
        source_email_id: null,
        proposed_options: [],
        selected_option: null,
        booked_event_id: null,
        request_type: 'book_new',
        requested_by: { email: 'client@test.com', name: 'Test' },
      };
      const requestRow =
        opts.requestData === undefined ? defaultRequest : opts.requestData;

      const selectChain: Record<string, MockFn> = {};
      selectChain.eq = vi.fn().mockImplementation(() => selectChain);
      selectChain.is = vi.fn().mockImplementation(() => selectChain);
      selectChain.maybeSingle = vi.fn().mockResolvedValue({
        data: requestRow,
        error: opts.requestError ?? null,
      });

      const dedupSelectChain: Record<string, MockFn> = {};
      dedupSelectChain.eq = vi.fn().mockImplementation(() => dedupSelectChain);
      dedupSelectChain.is = vi.fn().mockImplementation(() => dedupSelectChain);
      dedupSelectChain.maybeSingle = vi.fn().mockResolvedValue({
        data: opts.existingRequest ? { id: 'existing' } : null,
        error: null,
      });

      const updateChain: Record<string, MockFn> = {};
      updateChain.eq = vi.fn().mockImplementation(() => updateChain);

      return {
        select: vi.fn().mockImplementation((fields: string) => {
          if (fields === 'id') return dedupSelectChain;
          return selectChain;
        }),
        update: vi.fn().mockImplementation((data: unknown) => {
          capturedUpdates.push({ table, data, filters: {} });
          return updateChain;
        }),
        insert: vi.fn().mockImplementation((data: unknown) => {
          capturedInsertData = data;
          capturedInserts.push({ table, data });
          const insertChain: Record<string, MockFn> = {};
          insertChain.select = vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: opts.insertError
                ? null
                : {
                    id: 'new-req-id',
                    workspace_id:
                      capturedInsertData?.workspace_id ?? WORKSPACE_ID,
                    client_id: capturedInsertData?.client_id ?? CLIENT_ID,
                    source_email_id:
                      capturedInsertData?.source_email_id ?? null,
                    source_type:
                      capturedInsertData?.source_type ?? 'email_extraction',
                    request_type:
                      capturedInsertData?.request_type ?? 'book_new',
                    requested_by: capturedInsertData?.requested_by ?? {},
                    requested_slots: null,
                    duration_minutes:
                      capturedInsertData?.duration_minutes ?? 30,
                    preferences: capturedInsertData?.preferences ?? {},
                    status: 'pending',
                    proposed_options: [],
                    selected_option: null,
                    booked_event_id: null,
                    agent_run_id: null,
                    created_at: new Date().toISOString(),
                    resolved_at: null,
                  },
              error: opts.insertError ?? null,
            }),
          });
          return insertChain;
        }),
      };
    }
    if (table === 'client_calendars') {
      const calData = opts.noCalendars
        ? []
        : [
            {
              id: CAL_DB_ID,
              client_id: CLIENT_ID,
              calendar_id: 'cal-1',
              provider: 'google_calendar',
              oauth_state: {},
              sync_status: 'connected',
            },
          ];
      const chain: Record<string, MockFn> = {};
      chain.eq = vi.fn().mockImplementation(() => chain);
      chain.select = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue({ data: calData, error: null });
      chain.then = vi
        .fn()
        .mockImplementation((resolve: (v: unknown) => void) =>
          Promise.resolve({ data: calData, error: null }).then(resolve),
        );
      return { select: vi.fn().mockReturnValue(chain) };
    }
    if (table === 'agent_signals') {
      const selectChain: Record<string, MockFn> = {};
      selectChain.eq = vi.fn().mockImplementation(() => selectChain);
      selectChain.is = vi.fn().mockImplementation(() => selectChain);
      selectChain.limit = vi.fn().mockResolvedValue({
        data: opts.signalData ?? [],
        error: null,
      });
      const updateChain: Record<string, MockFn> = {};
      updateChain.eq = vi.fn().mockImplementation(() => updateChain);
      return {
        select: vi.fn().mockReturnValue(selectChain),
        insert: vi.fn().mockImplementation((data: unknown) => {
          capturedInserts.push({ table, data });
          return Promise.resolve({ error: null });
        }),
        update: vi.fn().mockImplementation((data: unknown) => {
          capturedUpdates.push({ table, data, filters: {} });
          return updateChain;
        }),
      };
    }
    if (table === 'calendar_events') {
      const insertChain: Record<string, MockFn> = {};
      insertChain.select = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: opts.eventInsertError ? null : { id: 'event-1' },
          error: opts.eventInsertError
            ? { message: opts.eventInsertError }
            : null,
        }),
      });
      const selectChain: Record<string, MockFn> = {};
      selectChain.eq = vi.fn().mockImplementation(() => selectChain);
      selectChain.gte = vi.fn().mockImplementation(() => selectChain);
      selectChain.lte = vi.fn().mockResolvedValue({ data: [], error: null });
      return {
        insert: vi.fn().mockImplementation((data: unknown) => {
          capturedInserts.push({ table, data });
          return insertChain;
        }),
        select: vi.fn().mockReturnValue(selectChain),
      };
    }
    if (table === 'clients') {
      const limitResult = {
        data: opts.noClients ? [] : [{ id: CLIENT_ID }],
        error: null,
      };
      const chain: Record<string, MockFn> = {};
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.ilike = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue(limitResult);
      return { select: vi.fn().mockReturnValue(chain) };
    }
    if (table === 'calendar_event_relations') {
      return { upsert: vi.fn().mockResolvedValue({ error: null }) };
    }
    return {};
  });

  return {
    from,
    _capturedInserts: capturedInserts,
    _capturedUpdates: capturedUpdates,
  } as unknown as InstanceType<
    (typeof import('@supabase/supabase-js'))['SupabaseClient']
  > &
    CapturedOps;
}
