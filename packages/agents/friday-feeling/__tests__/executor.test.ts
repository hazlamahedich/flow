import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn().mockReturnValue({ from: mockFrom }),
  insertSignal: vi.fn().mockResolvedValue(undefined),
}));

interface TrustTransition {
  agent_type: string;
  from_level: string;
  to_level: string;
  reached_at: string;
}

interface FridayFeelingResult {
  summaryId: string;
  tasksHandled: number;
  timeSavedMinutes: number;
  trustMilestones: TrustTransition[];
  headline: string;
}

function chainable(finalResult: { data: unknown; error: unknown | null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockResolvedValue(finalResult);
  chain.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  chain.single = vi.fn().mockResolvedValue(finalResult);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  return chain;
}

describe('Friday Feeling Agent — executor integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMocks(opts: {
    existingSummary?: Record<string, unknown> | null;
    runs?: Record<string, unknown>[];
    transitions?: Record<string, unknown>[];
    insertResult?: Record<string, unknown>;
  }) {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'friday_feeling_summaries') {
        const existing = chainable({
          data: opts.existingSummary ?? null,
          error: null,
        });
        const insertChain = chainable({
          data: opts.insertResult ?? { id: 'ff-new' },
          error: null,
        });
        return {
          select: existing.select,
          eq: existing.eq,
          maybeSingle: existing.maybeSingle,
          insert: insertChain.insert,
          single: insertChain.single,
        };
      }
      if (table === 'agent_runs') {
        const c = chainable({ data: opts.runs ?? [], error: null });
        return { select: c.select, eq: c.eq, gte: c.gte, lte: c.lte };
      }
      if (table === 'trust_transitions') {
        const c = chainable({ data: opts.transitions ?? [], error: null });
        return { select: c.select, eq: c.eq, gte: c.gte, lte: c.lte };
      }
      return chainable({ data: null, error: null });
    });
  }

  test('computes tasks_handled from completed agent_runs in the week', async () => {
    setupMocks({
      runs: [{ id: 'run-1' }, { id: 'run-2' }, { id: 'run-3' }],
      transitions: [],
    });

    const { execute } = await import('../src/executor');
    const result = await execute({
      workspaceId: 'ws-1',
      userId: 'user-1',
      weekStart: '2026-05-19',
      weekEnd: '2026-05-25',
      agentRunId: 'run-0',
      trigger: 'cron',
    }) as FridayFeelingResult;

    expect(result.tasksHandled).toBe(3);
    expect(result.timeSavedMinutes).toBe(15);
    expect(result.headline).toBe("Here's what you accomplished. Now go live your life.");
  });

  test('captures trust milestones from trust_transitions table', async () => {
    setupMocks({
      runs: [{ id: 'run-1' }],
      transitions: [{
        agent_id: 'time_integrity',
        from_level: 'supervised',
        to_level: 'confirm',
        created_at: '2026-05-22T14:00:00Z',
      }],
    });

    const { execute } = await import('../src/executor');
    const result = await execute({
      workspaceId: 'ws-1',
      userId: 'user-1',
      weekStart: '2026-05-19',
      weekEnd: '2026-05-25',
      agentRunId: 'run-0',
      trigger: 'cron',
    }) as FridayFeelingResult;

    expect(result.trustMilestones).toHaveLength(1);
    expect(result.trustMilestones[0]!.agent_type).toBe('time_integrity');
    expect(result.trustMilestones[0]!.to_level).toBe('confirm');
  });

  test('falls back to empty-inbox reassurance for zero activity weeks', async () => {
    setupMocks({
      runs: [],
      transitions: [],
    });

    const { execute } = await import('../src/executor');
    const result = await execute({
      workspaceId: 'ws-1',
      userId: 'user-1',
      weekStart: '2026-05-19',
      weekEnd: '2026-05-25',
      agentRunId: 'run-0',
      trigger: 'cron',
    }) as FridayFeelingResult;

    expect(result.tasksHandled).toBe(0);
    expect(result.timeSavedMinutes).toBe(0);
    expect(result.trustMilestones).toHaveLength(0);
    expect(result.headline).toContain('blank canvas');
  });

  test('is idempotent — does not insert duplicate summaries for same week', async () => {
    setupMocks({
      existingSummary: {
        id: 'ff-existing',
        tasks_handled: 10,
        time_saved_minutes: 50,
        trust_milestones: [],
        headline: 'Existing',
      },
    });

    const { execute } = await import('../src/executor');
    const result = await execute({
      workspaceId: 'ws-1',
      userId: 'user-1',
      weekStart: '2026-05-19',
      weekEnd: '2026-05-25',
      agentRunId: 'run-0',
      trigger: 'cron',
    }) as FridayFeelingResult;

    expect(result.summaryId).toBe('ff-existing');
  });
});
