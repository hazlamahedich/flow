import { describe, it, expect, beforeEach, vi } from 'vitest';
import { consumeSchedulingSignal } from '../signal-consumer';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const CLIENT_ID = '00000000-0000-4000-8000-000000000002';
const SIGNAL_ID = '00000000-0000-4000-8000-000000000010';

function createMockSupabase(opts: {
  noClients?: boolean;
  existingRequest?: boolean;
  insertError?: { code?: string; message: string } | null;
} = {}) {
  let capturedInsertData: Record<string, unknown> | null = null;

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'clients') {
      const limitResult = {
        data: opts.noClients ? [] : [{ id: CLIENT_ID }],
        error: null,
      };
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.ilike = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue(limitResult);
      return { select: vi.fn().mockReturnValue(chain) };
    }
    if (table === 'scheduling_requests') {
      const selectChain: Record<string, ReturnType<typeof vi.fn>> = {};
      selectChain.eq = vi.fn().mockImplementation(() => selectChain);
      selectChain.is = vi.fn().mockImplementation(() => selectChain);
      selectChain.maybeSingle = vi.fn().mockResolvedValue({
        data: opts.existingRequest ? { id: 'existing' } : null,
        error: null,
      });

      const insertChain: Record<string, ReturnType<typeof vi.fn>> = {};
      insertChain.select = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockImplementation(() => {
          if (opts.insertError) {
            return Promise.resolve({ data: null, error: opts.insertError });
          }
          const inserted = capturedInsertData ?? {};
          const row = {
            id: 'new-req-id',
            workspace_id: inserted.workspace_id ?? WORKSPACE_ID,
            client_id: inserted.client_id ?? CLIENT_ID,
            source_email_id: inserted.source_email_id ?? null,
            source_type: inserted.source_type ?? 'email_extraction',
            request_type: inserted.request_type ?? 'book_new',
            requested_by: inserted.requested_by ?? {},
            requested_slots: inserted.requested_slots ?? null,
            duration_minutes: inserted.duration_minutes ?? 30,
            preferences: inserted.preferences ?? {},
            status: inserted.status ?? 'pending',
            proposed_options: inserted.proposed_options ?? [],
            selected_option: null,
            booked_event_id: null,
            agent_run_id: null,
            created_at: new Date().toISOString(),
            resolved_at: null,
          };
          return Promise.resolve({ data: row, error: null });
        }),
      });
      (insertChain as Record<string, unknown>)._capture = (data: Record<string, unknown>) => { capturedInsertData = data; };

      return {
        select: vi.fn().mockReturnValue(selectChain),
        insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          capturedInsertData = data;
          return insertChain;
        }),
      };
    }
    if (table === 'agent_signals') {
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    }
    return {};
  });
  return { from } as unknown as InstanceType<typeof import('@supabase/supabase-js')['SupabaseClient']>;
}

function makeSignal(actionType: string = 'schedule_meeting') {
  return {
    id: SIGNAL_ID,
    workspaceId: WORKSPACE_ID,
    payload: {
      actionType,
      senderEmail: 'client@example.com',
      senderName: 'Test Client',
      duration: 30,
      timezone: 'America/New_York',
    },
    entityId: null,
  };
}

describe('consumeSchedulingSignal', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns unknown_action for non-scheduling action types', async () => {
    const result = await consumeSchedulingSignal(makeSignal('reply'), { supabase: createMockSupabase() });
    expect(result.status).toBe('unknown_action');
    expect(result.schedulingRequest).toBeNull();
  });

  it('creates scheduling request for schedule_meeting action', async () => {
    const result = await consumeSchedulingSignal(makeSignal('schedule_meeting'), { supabase: createMockSupabase() });
    expect(result.status).toBe('created');
    expect(result.schedulingRequest).not.toBeNull();
    expect(result.schedulingRequest!.requestType).toBe('book_new');
  });

  it('creates scheduling request for reschedule action', async () => {
    const result = await consumeSchedulingSignal(makeSignal('reschedule'), { supabase: createMockSupabase() });
    expect(result.status).toBe('created');
    expect(result.schedulingRequest!.requestType).toBe('reschedule');
  });

  it('returns no_client_match when sender not found', async () => {
    const result = await consumeSchedulingSignal(makeSignal(), { supabase: createMockSupabase({ noClients: true }) });
    expect(result.status).toBe('no_client_match');
  });

  it('returns duplicate for already-processed signal', async () => {
    const result = await consumeSchedulingSignal(
      makeSignal(),
      { supabase: createMockSupabase({ existingRequest: true }) },
    );
    expect(result.status).toBe('duplicate');
  });

  it('handles unique constraint violation on insert as duplicate', async () => {
    const result = await consumeSchedulingSignal(
      makeSignal(),
      { supabase: createMockSupabase({ insertError: { code: '23505', message: 'dup' } }) },
    );
    expect(result.status).toBe('duplicate');
  });

  it('uses entityId as source_email_id when it is a valid UUID', async () => {
    const signal = {
      ...makeSignal(),
      entityId: '00000000-0000-4000-8000-000000000099',
    };
    const result = await consumeSchedulingSignal(signal, { supabase: createMockSupabase() });
    expect(result.status).toBe('created');
  });

  it('dedup query uses .is(source_email_id, null) for signals without email (H2)', async () => {
    const signal = {
      ...makeSignal(),
      senderEmail: undefined,
      senderName: 'Unknown Sender',
    };
    const result = await consumeSchedulingSignal(signal, { supabase: createMockSupabase() });
    expect(result.status).toBe('created');
  });
});
