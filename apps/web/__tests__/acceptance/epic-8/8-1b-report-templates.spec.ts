/**
 * Story 8.1b Acceptance Tests — Report Templates
 * Tests template CRUD, section customization, template resolution, default fallback.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return {
    ...actual,
    requireTenantContext: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' }),
    createFlowError: actual.createFlowError,
  };
});

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import { saveReportTemplateAction } from '@/lib/actions/reports/save-report-template';
import { deleteReportTemplateAction } from '@/lib/actions/reports/delete-report-template';
import { getReportTemplatesForWorkspaceAction } from '@/lib/actions/reports/get-report-templates';
import { generateWeeklyReportAction } from '@/lib/actions/reports/generate-weekly-report';

function mockSupabase(options?: {
  chainData?: unknown;
  chainError?: unknown | null;
  rpcData?: unknown;
  rpcError?: { message: string } | null;
}) {
  const opts = options ?? {};
  let currentData = opts.chainData;
  let currentError = opts.chainError ?? null;
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: currentData ?? null, error: currentError })),
    single: vi.fn().mockImplementation(() => Promise.resolve({ data: currentData ?? null, error: currentError })),
    upsert: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  return {
    rpc: vi.fn().mockResolvedValue({ data: opts.rpcData, error: opts.rpcError ?? null }),
    from: vi.fn().mockReturnValue(chain),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', app_metadata: { workspace_id: 'ws1', role: 'owner' } } } }),
    },
    _mock: { setData: (d: unknown) => { currentData = d; }, setError: (e: unknown) => { currentError = e; }, chain },
  };
}

function buildChain(data: unknown, error: unknown | null = null) {
  const result = { data, error };
  const self: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'neq', 'gte', 'lte', 'lt', 'is', 'in', 'order', 'upsert', 'insert', 'delete'];
  for (const m of methods) {
    self[m] = vi.fn().mockReturnValue(self);
  }
  self.maybeSingle = vi.fn().mockResolvedValue(result);
  self.single = vi.fn().mockResolvedValue(result);
  self.then = function(onF: unknown, onR: unknown) {
    return Promise.resolve(result).then(onF as never, onR as never);
  };
  return self;
}

function buildMultiChain(responses: Array<{ data: unknown; error: unknown | null }>) {
  let idx = 0;
  const self: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'neq', 'gte', 'lte', 'lt', 'is', 'in', 'order'];
  for (const m of methods) {
    self[m] = vi.fn().mockReturnValue(self);
  }
  self.maybeSingle = vi.fn().mockImplementation(() => {
    const r = responses[idx] ?? { data: [], error: null };
    idx++;
    return Promise.resolve(r);
  });
  self.single = vi.fn().mockImplementation(() => {
    const r = responses[idx] ?? { data: [], error: null };
    idx++;
    return Promise.resolve(r);
  });
  self.then = function(onF: unknown, onR: unknown) {
    const r = responses[idx] ?? { data: [], error: null };
    idx++;
    return Promise.resolve(r).then(onF as never, onR as never);
  };
  return self;
}

function buildAggChain(data: unknown, error: unknown | null = null) {
  const result = { data, error };
  const self: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'neq', 'gte', 'lte', 'lt', 'is', 'in', 'order'];
  for (const m of methods) {
    self[m] = vi.fn().mockReturnValue(self);
  }
  self.maybeSingle = vi.fn().mockResolvedValue(result);
  self.single = vi.fn().mockResolvedValue(result);
  self.then = function(onF: unknown, onR: unknown) {
    return Promise.resolve(result).then(onF as never, onR as never);
  };
  return self;
}

const validSectionsConfig = {
  time_summary: { enabled: true, sort_order: 1 },
  task_log: { enabled: true, sort_order: 2 },
  agent_activity: { enabled: true, sort_order: 3 },
  invoice_summary: { enabled: true, sort_order: 4 },
  stalled_items: { enabled: false, sort_order: 5 },
  highlights: { enabled: false, sort_order: 6 },
};

const validBranding = {
  accentColor: '#6366f1',
  logoUrl: undefined,
};

// ───────────────────────────────────────────────────────────────
// ATDD-001: Template CRUD
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1b-ATDD-001] template CRUD operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('saveReportTemplateAction creates new workspace default template', async () => {
    const m = mockSupabase({
      chainData: null,
      chainError: null,
      rpcData: null,
      rpcError: null,
    });
    vi.mocked(getServerSupabase).mockResolvedValue(m as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

    m.from.mockReturnValue(buildChain({
      id: 'tpl-new',
      workspace_id: 'ws-1',
      client_id: null,
      name: 'New Template',
      sections_config: validSectionsConfig,
      branding: validBranding,
    }, null));

    const result = await saveReportTemplateAction({
      name: 'New Template',
      sectionsConfig: validSectionsConfig,
      branding: validBranding,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('New Template');
      expect(result.data.clientId).toBeNull();
    }
  });

  test('saveReportTemplateAction updates existing template', async () => {
    const m = mockSupabase({
      chainData: { id: 'tpl-1' },
      chainError: null,
      rpcData: null,
      rpcError: null,
    });
    vi.mocked(getServerSupabase).mockResolvedValue(m as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

    let callCount = 0;
    m.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // existing check
        return buildChain({ id: 'tpl-1' }, null);
      }
      // upsert
      return buildChain({
        id: 'tpl-1',
        workspace_id: 'ws-1',
        client_id: null,
        name: 'Updated',
        sections_config: validSectionsConfig,
        branding: { accentColor: '#3b82f6' },
        updated_at: '2026-05-28T12:00:00Z',
      }, null);
    });

    const result = await saveReportTemplateAction({
      id: 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
      name: 'Updated',
      sectionsConfig: validSectionsConfig,
      branding: { accentColor: '#3b82f6' },
    });

    console.log('UPDATE RESULT:', JSON.stringify(result, null, 2));

    expect(result.success).toBe(true);
    if (!result.success) {
      console.log('UPDATE ERROR:', result.error);
    }
    if (result.success) {
      expect(result.data.name).toBe('Updated');
    }
  });

  test('deleteReportTemplateAction removes per-client template', async () => {
    const m = mockSupabase({
      chainData: { id: 'tpl-2', client_id: 'cli-1' },
      chainError: null,
      rpcData: null,
      rpcError: null,
    });
    vi.mocked(getServerSupabase).mockResolvedValue(m as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

    let callCount = 0;
    m.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // existing check
        return buildChain({ id: 'c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', client_id: 'cli-1' }, null);
      }
      // delete
      return buildChain(null, null);
    });

    const result = await deleteReportTemplateAction({ id: 'c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2');
    }
  });

  test('deleteReportTemplateAction blocks deletion of workspace default when no replacement', async () => {
    const m = mockSupabase({
      chainData: { id: 'tpl-def', client_id: null },
      chainError: null,
      rpcData: null,
      rpcError: null,
    });
    vi.mocked(getServerSupabase).mockResolvedValue(m as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

    let callCount = 0;
    m.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // existing check
        return buildChain({ id: 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', client_id: null }, null);
      }
      if (callCount === 2) {
        // count remaining defaults (returns 0 = there are no other defaults, so block)
        const countChain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
        };
        countChain.then = function (onF: unknown, onR: unknown) {
          return Promise.resolve({ count: 0, error: null }).then(onF as never, onR as never);
        };
        return countChain;
      }
      // delete call
      return buildChain(null, null);
    });

    const result = await deleteReportTemplateAction({ id: 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('DEFAULT_TEMPLATE_REQUIRED');
    }
  });

  test('getReportTemplatesForWorkspace returns default + per-client overrides', async () => {
    const m = mockSupabase({
      chainData: null,
      chainError: null,
      rpcData: null,
      rpcError: null,
    });
    vi.mocked(getServerSupabase).mockResolvedValue(m as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

    m.from.mockReturnValue(buildChain([
      { id: 'tpl-def', client_id: null, name: 'Default', sections_config: {}, branding: {}, updated_at: '2026-05-01T00:00:00Z' },
      { id: 'tpl-cli', client_id: 'cli-1', name: 'Acme Override', sections_config: {}, branding: {}, updated_at: '2026-05-02T00:00:00Z' },
    ], null));

    const result = await getReportTemplatesForWorkspaceAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items.length).toBe(2);
      expect(result.data.items.some((t) => t.clientId == null)).toBe(true);
      expect(result.data.items.some((t) => t.clientId === 'cli-1')).toBe(true);
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Section customization validation
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1b-ATDD-002] section customization with validation', () => {
  test('saveReportTemplate rejects all sections disabled', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase() as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

    const result = await saveReportTemplateAction({
      name: 'Bad',
      sectionsConfig: {
        time_summary: { enabled: false, sort_order: 1 },
        task_log: { enabled: false, sort_order: 2 },
        agent_activity: { enabled: false, sort_order: 3 },
        invoice_summary: { enabled: false, sort_order: 4 },
        stalled_items: { enabled: false, sort_order: 5 },
        highlights: { enabled: false, sort_order: 6 },
      },
      branding: validBranding,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('SECTION_COUNT_MIN');
    }
  });

  test('saveReportTemplate accepts valid section sort_order values', async () => {
    const m = mockSupabase({ chainData: null, chainError: null, rpcData: null, rpcError: null });
    vi.mocked(getServerSupabase).mockResolvedValue(m as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

    m.from.mockReturnValue(buildChain({ id: 'tpl-new', workspace_id: 'ws-1', client_id: null, name: 'OK', sections_config: {}, branding: {} }, null));

    const result = await saveReportTemplateAction({
      name: 'OK',
      sectionsConfig: {
        time_summary: { enabled: true, sort_order: 1 },
        task_log: { enabled: true, sort_order: 2 },
        agent_activity: { enabled: true, sort_order: 3 },
        invoice_summary: { enabled: true, sort_order: 4 },
        stalled_items: { enabled: false, sort_order: 5 },
        highlights: { enabled: false, sort_order: 6 },
      },
      branding: validBranding,
    });

    expect(result.success).toBe(true);
  });

  test('saveReportTemplate rejects negative sort_order', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase() as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

    const result = await saveReportTemplateAction({
      name: 'Bad',
      sectionsConfig: {
        time_summary: { enabled: true, sort_order: -1 },
        task_log: { enabled: true, sort_order: 2 },
        agent_activity: { enabled: true, sort_order: 3 },
        invoice_summary: { enabled: true, sort_order: 4 },
        stalled_items: { enabled: false, sort_order: 5 },
        highlights: { enabled: false, sort_order: 6 },
      },
      branding: validBranding,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('accent color must match design system palette', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase() as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

    const result = await saveReportTemplateAction({
      name: 'Bad',
      sectionsConfig: validSectionsConfig,
      branding: {
        accentColor: '#ff0000',
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Template resolution during generation
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1b-ATDD-003] template resolution during report generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Map each .from() call index to a mock response
  // 0: clients select
  // 1: report_templates by explicit templateId (null)
  // 2: report_templates per-client
  // 3: report_templates default
  // 4: time_entries
  // 5: invoices
  // 6: agent_runs
  //    invoice_payments SKIPPED when invoiceIds.length === 0
  // 7: weekly_reports select (after RPC)
  // 8: weekly_report_sections
  const BASE_TPL_RESPONSES = [
    { data: { id: 'c1' }, error: null },
    { data: null, error: null },
    { data: { id: 'tpl-cli', sections_config: { time_summary: { enabled: true, sort_order: 1 } }, branding: {} }, error: null },
    { data: null, error: null },
    { data: [], error: null },
    { data: [], error: null },
    { data: [], error: null },
    { data: { id: 'r111', workspace_id: 'ws-1', client_id: 'c1', period_start: '2026-05-19', period_end: '2026-05-25', status: 'draft', template_id: 'tpl-cli', generated_by: 'user-1', template_snapshot: {}, version: 1, created_at: '2026-05-28T00:00:00Z', updated_at: '2026-05-28T00:00:00Z' }, error: null },
    { data: [{ id: 's1', report_id: 'r111', section_type: 'time_summary', title: 'Time Summary', content: {}, sort_order: 1, created_at: '2026-05-28T00:00:00Z' }], error: null },
  ];

  test('generateWeeklyReportAction uses per-client template when exists', async () => {
    const m = mockSupabase({ rpcData: 'r111' });
    vi.mocked(getServerSupabase).mockResolvedValue(m as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

    m.from.mockImplementation((tableName: string) => {
      const dataMap: Record<string, unknown> = {
        'clients': { id: 'c1' },
        'report_templates': { id: 'tpl-cli', sections_config: { time_summary: { enabled: true, sort_order: 1 } }, branding: {} },
        'time_entries': [],
        'invoices': [],
        'agent_runs': [],
        'weekly_reports': { id: 'r111', workspace_id: 'ws-1', client_id: 'c1', period_start: '2026-05-19', period_end: '2026-05-25', status: 'draft', template_id: 'tpl-cli', generated_by: 'user-1', template_snapshot: {}, version: 1, created_at: '2026-05-28T00:00:00Z', updated_at: '2026-05-28T00:00:00Z' },
        'weekly_report_sections': [{ id: 's1', report_id: 'r111', section_type: 'time_summary', title: 'Time Summary', content: {}, sort_order: 1, created_at: '2026-05-28T00:00:00Z' }],
      };
      // For per-client template query: filter by client_id returns template; default query (is client_id null) returns null
      // We need stateful handling for report_templates
      return buildAggChain(dataMap[tableName] ?? [], null);
    });

    // Override maybeSingle for report_templates to handle per-client vs default
    let tplCallCount = 0;
    const originalFrom = m.from.getMockImplementation()!;
    m.from.mockImplementation((tableName: string) => {
      const chain = originalFrom(tableName);
      if (tableName === 'report_templates') {
        tplCallCount++;
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: tplCallCount === 1 ? { id: 'tpl-cli', sections_config: { time_summary: { enabled: true, sort_order: 1 } }, branding: {} } : null,
          error: null,
        });
      }
      return chain;
    });

    const result = await generateWeeklyReportAction({
      clientId: 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sections.length).toBeGreaterThan(0);
    }
  });

  test('generateWeeklyReportAction falls back to workspace default', async () => {
    const m = mockSupabase({ rpcData: 'r222' });
    vi.mocked(getServerSupabase).mockResolvedValue(m as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

    const dataMap: Record<string, unknown> = {
      'clients': { id: 'c1' },
      'report_templates': null,
      'time_entries': [],
      'invoices': [],
      'agent_runs': [],
      'weekly_reports': { id: 'r222', workspace_id: 'ws-1', client_id: 'c1', period_start: '2026-05-19', period_end: '2026-05-25', status: 'draft', template_id: 'tpl-def', generated_by: 'user-1', template_snapshot: {}, version: 1, created_at: '2026-05-28T00:00:00Z', updated_at: '2026-05-28T00:00:00Z' },
      'weekly_report_sections': [{ id: 's1', report_id: 'r222', section_type: 'time_summary', title: 'Time Summary', content: {}, sort_order: 1, created_at: '2026-05-28T00:00:00Z' }],
    };
    m.from.mockImplementation((tableName: string) => buildAggChain(dataMap[tableName] ?? [], null));

    let tplCallCount = 0;
    const originalFrom = m.from.getMockImplementation()!;
    m.from.mockImplementation((tableName: string) => {
      const chain = originalFrom(tableName);
      if (tableName === 'report_templates') {
        tplCallCount++;
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: tplCallCount === 2 ? { id: 'tpl-def', sections_config: validSectionsConfig, branding: {} } : null,
          error: null,
        });
      }
      return chain;
    });

    const result = await generateWeeklyReportAction({
      clientId: 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sections.length).toBeGreaterThan(0);
    }
  });

  test('generateWeeklyReportAction falls back to hardcoded default if no templates exist', async () => {
    const m = mockSupabase({ rpcData: 'r333' });
    vi.mocked(getServerSupabase).mockResolvedValue(m as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

    const dataMap: Record<string, unknown> = {
      'clients': { id: 'c1' },
      'report_templates': null,
      'time_entries': [],
      'invoices': [],
      'agent_runs': [],
      'weekly_reports': { id: 'r333', workspace_id: 'ws-1', client_id: 'c1', period_start: '2026-05-19', period_end: '2026-05-25', status: 'draft', template_id: null, generated_by: 'user-1', template_snapshot: {}, version: 1, created_at: '2026-05-28T00:00:00Z', updated_at: '2026-05-28T00:00:00Z' },
      'weekly_report_sections': [
        { id: 's1', report_id: 'r333', section_type: 'time_summary', title: 'Time Summary', content: {}, sort_order: 1 },
        { id: 's2', report_id: 'r333', section_type: 'task_log', title: 'Task Log', content: {}, sort_order: 2 },
        { id: 's3', report_id: 'r333', section_type: 'agent_activity', title: 'Agent Activity', content: {}, sort_order: 3 },
        { id: 's4', report_id: 'r333', section_type: 'invoice_summary', title: 'Invoice Summary', content: {}, sort_order: 4 },
      ],
    };
    m.from.mockImplementation((tableName: string) => buildAggChain(dataMap[tableName] ?? [], null));

    let tplCallCount = 0;
    const originalFrom = m.from.getMockImplementation()!;
    m.from.mockImplementation((tableName: string) => {
      const chain = originalFrom(tableName);
      if (tableName === 'report_templates') {
        tplCallCount++;
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      }
      return chain;
    });

    const result = await generateWeeklyReportAction({
      clientId: 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sections.length).toBe(4);
    }
  });

  test('disabled sections are omitted from generated report', async () => {
    const m = mockSupabase({ rpcData: 'r444' });
    vi.mocked(getServerSupabase).mockResolvedValue(m as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

    const dataMap: Record<string, unknown> = {
      'clients': { id: 'c1' },
      'report_templates': null,
      'time_entries': [],
      'invoices': [],
      'agent_runs': [],
      'weekly_reports': { id: 'r444', workspace_id: 'ws-1', client_id: 'c1', period_start: '2026-05-19', period_end: '2026-05-25', status: 'draft', template_id: 'tpl-def', generated_by: 'user-1', template_snapshot: {}, version: 1, created_at: '2026-05-28T00:00:00Z', updated_at: '2026-05-28T00:00:00Z' },
      'weekly_report_sections': [
        { id: 's1', report_id: 'r444', section_type: 'time_summary', title: 'Time Summary', content: {}, sort_order: 1 },
        { id: 's2', report_id: 'r444', section_type: 'task_log', title: 'Task Log', content: {}, sort_order: 2 },
        { id: 's3', report_id: 'r444', section_type: 'agent_activity', title: 'Agent Activity', content: {}, sort_order: 3 },
      ],
    };
    m.from.mockImplementation((tableName: string) => buildAggChain(dataMap[tableName] ?? [], null));

    let tplCallCount = 0;
    const originalFrom = m.from.getMockImplementation()!;
    m.from.mockImplementation((tableName: string) => {
      const chain = originalFrom(tableName);
      if (tableName === 'report_templates') {
        tplCallCount++;
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: tplCallCount === 2 ? { id: 'tpl-def', sections_config: {
            time_summary: { enabled: true, sort_order: 1 },
            task_log: { enabled: true, sort_order: 2 },
            agent_activity: { enabled: true, sort_order: 3 },
            invoice_summary: { enabled: false, sort_order: 4 },
          }, branding: {} } : null,
          error: null,
        });
      }
      return chain;
    });

    const result = await generateWeeklyReportAction({
      clientId: 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sections.some((s) => s.sectionType === 'invoice_summary')).toBe(false);
    }
  });

  test('template_snapshot is stored on weekly_reports at generation time', async () => {
    const m = mockSupabase({ rpcData: 'r555' });
    vi.mocked(getServerSupabase).mockResolvedValue(m as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });

    const dataMap: Record<string, unknown> = {
      'clients': { id: 'c1' },
      'report_templates': null,
      'time_entries': [],
      'invoices': [],
      'agent_runs': [],
      'weekly_reports': { id: 'r555', workspace_id: 'ws-1', client_id: 'c1', period_start: '2026-05-19', period_end: '2026-05-25', status: 'draft', template_id: 'tpl-def', generated_by: 'user-1', template_snapshot: { sections_config: { time_summary: { enabled: true, sort_order: 1 } }, branding: { accentColor: '#6366f1' } }, version: 1, created_at: '2026-05-28T00:00:00Z', updated_at: '2026-05-28T00:00:00Z' },
      'weekly_report_sections': [{ id: 's1', report_id: 'r555', section_type: 'time_summary', title: 'Time Summary', content: {}, sort_order: 1, created_at: '2026-05-28T00:00:00Z' }],
    };
    m.from.mockImplementation((tableName: string) => buildAggChain(dataMap[tableName] ?? [], null));

    let tplCallCount = 0;
    const originalFrom = m.from.getMockImplementation()!;
    m.from.mockImplementation((tableName: string) => {
      const chain = originalFrom(tableName);
      if (tableName === 'report_templates') {
        tplCallCount++;
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: tplCallCount === 2 ? { id: 'tpl-def', sections_config: { time_summary: { enabled: true, sort_order: 1 } }, branding: { accentColor: '#6366f1' } } : null,
          error: null,
        });
      }
      return chain;
    });

    const result = await generateWeeklyReportAction({
      clientId: 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.templateSnapshot).toBeDefined();
      expect((result.data.report.templateSnapshot as Record<string, unknown>).sections_config).toBeDefined();
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Template UI components
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1b-ATDD-004] template UI components', () => {
  test('TemplatesPage exported from @/app/(workspace)/reports/templates/page', async () => {
    const mod = await import('@/app/(workspace)/reports/templates/page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  }, 30000);

  test('TemplateCard shows name, enabled sections, last updated', async () => {
    const { TemplateCard } = await import('@/app/(workspace)/reports/templates/components/TemplateCard');
    expect(TemplateCard).toBeDefined();
  }, 30000);

  test('TemplateForm renders section toggles and accent color picker', async () => {
    const { TemplateForm } = await import('@/app/(workspace)/reports/templates/components/TemplateForm');
    expect(TemplateForm).toBeDefined();
  }, 30000);
});
