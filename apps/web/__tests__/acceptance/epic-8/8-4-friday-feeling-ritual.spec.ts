/**
 * Story 8.4 Acceptance Tests — Friday Feeling Ritual
 * Tests weekly summary generation, accumulated value display, The Exhale screen,
 * Wednesday micro-affirmation, and orchestrated inbox surfacing.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return {
    ...actual,
    requireTenantContext: vi.fn().mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'owner',
    }),
    createFlowError: actual.createFlowError,
    cacheTag: vi.fn((entity: string, ws: string) => `${entity}:${ws}`),
    invalidateAfterMutation: vi.fn(),
  };
});

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('@flow/agents/friday-feeling', () => ({
  execute: vi.fn().mockResolvedValue({
    summaryId: 'ff-1',
    tasksHandled: 23,
    timeSavedMinutes: 185,
    trustMilestones: [
      {
        agent_type: 'time_integrity',
        from_level: 'suggest',
        to_level: 'auto_approve',
        reached_at: '2026-05-22T14:00:00Z',
      },
    ],
    headline: "Here's what you accomplished. Now go live your life.",
  }),
  preCheck: vi.fn().mockResolvedValue({ passed: true, errors: [] }),
  executeWednesdayAffirmation: vi
    .fn()
    .mockResolvedValue({ affirmationIds: ['wa-1'], generated: 1 }),
}));

function mockSupabase(rpcResult: unknown, rpcError?: Error, rowData?: unknown) {
  const resolvedData = { data: rowData ?? null, error: rpcError ?? null };
  const fromChain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(resolvedData),
    single: vi.fn().mockResolvedValue(resolvedData),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
  };
  Object.defineProperty(fromChain, 'then', {
    value: (resolve: (v: unknown) => void) => resolve(resolvedData),
    configurable: true,
  });
  return {
    rpc: vi
      .fn()
      .mockResolvedValue({ data: rpcResult, error: rpcError ?? null }),
    from: vi.fn().mockReturnValue(fromChain),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

function mockFridayFeelingSummary() {
  return {
    id: 'ff-1',
    workspace_id: 'ws-1',
    user_id: 'user-1',
    week_start: '2026-05-19',
    week_end: '2026-05-25',
    headline: "Here's what you accomplished. Now go live your life.",
    tasks_handled: 23,
    time_saved_minutes: 185,
    trust_milestones: [
      {
        agent_type: 'time_integrity',
        from_level: 'suggest',
        to_level: 'auto_approve',
        reached_at: '2026-05-22T14:00:00Z',
      },
    ],
    generated_at: '2026-05-26T16:00:00Z',
    dismissed_at: null,
  };
}

function mockWednesdayAffirmation() {
  return {
    id: 'wa-1',
    workspace_id: 'ws-1',
    team_member_id: 'user-2',
    story:
      'Alice reached auto_approve trust level for the Calendar Agent this week.',
    milestone: { agent_type: 'calendar', trust_level: 'auto_approve' },
    generated_at: '2026-05-21T09:00:00Z',
    dismissed_at: null,
  };
}

// ───────────────────────────────────────────────────────────────
// ATDD-001: Friday Feeling summary generated with headline
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.4-ATDD-001] friday feeling summary generated with headline and accumulated value', () => {
  test('FridayFeelingAgent execute function exists in packages/agents', async () => {
    const agent = await import('@flow/agents/friday-feeling');
    expect(agent.execute).toBeDefined();
    expect(typeof agent.execute).toBe('function');
  });

  test('getFridayFeelingAction returns summary for current week', async () => {
    const { getServerSupabase } = await import('@/lib/supabase-server');
    const summary = mockFridayFeelingSummary();
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSupabase(null, undefined, summary),
    );

    const { getFridayFeelingAction } =
      await import('@/lib/actions/reports/get-friday-feeling');
    const result = await getFridayFeelingAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.headline).toBe(
        "Here's what you accomplished. Now go live your life.",
      );
      expect(result.data.tasksHandled).toBe(23);
      expect(result.data.timeSavedMinutes).toBe(185);
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: The Exhale completion screen with visible impact stories
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.4-ATDD-002] the exhale completion screen shows visible impact stories', () => {
  test('ExhaleScreen component is exported from @/components/reports/exhale-screen', async () => {
    const mod = await import('@/components/reports/exhale-screen');
    expect(mod.ExhaleScreen).toBeDefined();
  });

  test('exhale screen renders impact stories from summary data', async () => {
    const { renderExhaleScreen } =
      await import('@/components/reports/exhale-screen');
    const summary = mockFridayFeelingSummary();
    const html = renderExhaleScreen({
      id: summary.id,
      weekStart: summary.week_start,
      weekEnd: summary.week_end,
      headline: summary.headline,
      tasksHandled: summary.tasks_handled,
      timeSavedMinutes: summary.time_saved_minutes,
      trustMilestones: summary.trust_milestones,
      generatedAt: summary.generated_at,
      dismissedAt: summary.dismissed_at,
    });
    expect(html).toContain('time_integrity');
    expect(html).toContain('auto_approve');
    expect(html).toContain('23');
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Wednesday micro-affirmation for agency workspaces
// ───────────────────────────────────────────────────────────────
describe('[P1] [8.4-ATDD-003] wednesday micro-affirmation highlights team member trust milestones', () => {
  test('getWednesdayAffirmationAction is defined', async () => {
    const mod = await import('@/lib/actions/reports/get-wednesday-affirmation');
    expect(mod.getWednesdayAffirmationAction).toBeDefined();
    expect(typeof mod.getWednesdayAffirmationAction).toBe('function');
  });

  test('affirmation returns team member trust milestone story', async () => {
    const { getServerSupabase } = await import('@/lib/supabase-server');
    const affirmation = mockWednesdayAffirmation();
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSupabase(null, undefined, affirmation),
    );

    const { getWednesdayAffirmationAction } =
      await import('@/lib/actions/reports/get-wednesday-affirmation');
    const result = await getWednesdayAffirmationAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.story).toContain('auto_approve');
      expect(result.data.milestone).toBeDefined();
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Friday Feeling surfaces in orchestrated workflow inbox
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.4-ATDD-004] friday feeling summary surfaces in orchestrated workflow inbox', () => {
  test('Friday Feeling appears as inbox item with type "friday_feeling"', async () => {
    const { getServerSupabase } = await import('@/lib/supabase-server');
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSupabase(null, undefined, [mockFridayFeelingSummary()]),
    );

    const { getInboxItems } =
      await import('@/lib/actions/inbox/get-inbox-items');
    const result = await getInboxItems();

    expect(result.success).toBe(true);
    if (result.success) {
      const ffItems = result.data.filter(
        (item: { type: string }) => item.type === 'friday_feeling',
      );
      expect(ffItems.length).toBeGreaterThan(0);
    }
  });

  test('friday feeling inbox item has dismiss action', async () => {
    const { getServerSupabase } = await import('@/lib/supabase-server');
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockSupabase(null, undefined, { id: 'ff-1', tasks_handled: 1 }),
    );

    const { dismissFridayFeelingAction } =
      await import('@/lib/actions/reports/dismiss-friday-feeling');
    const result = await dismissFridayFeelingAction({
      summaryId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    });

    expect(result.success).toBe(true);
  });
});
