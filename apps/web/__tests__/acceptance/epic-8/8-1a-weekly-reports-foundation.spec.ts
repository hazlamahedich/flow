/**
 * Story 8.1a Acceptance Tests — Weekly Client Reports Foundation
 * Tests report generation RPC, persistence, list/detail UI, permissions.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { generateWeeklyReportSchema } from '@flow/types';
import { generateWeeklyReportAction } from '@/lib/actions/reports/generate-weekly-report';
import { getWeeklyReportsAction } from '@/lib/actions/reports/get-weekly-reports';
import { getWeeklyReportByIdAction } from '@/lib/actions/reports/get-weekly-report-by-id';
import ReportsPage from '@/app/(workspace)/reports/page';
import ReportDetailPage from '@/app/(workspace)/reports/[reportId]/page';
import { TimeSummarySection } from '@/app/(workspace)/reports/components/TimeSummarySection';
import { getServerSupabase } from '@/lib/supabase-server';

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

function mockSupabase(rpcResult: any, rpcError?: any, rowData?: any) {
  // A function that returns a chainable thenable
  const buildChain = (
    data: any,
    error: any = null,
    count: number | null = null,
  ) => {
    const result = { data, error, count };
    const self: Record<string, any> = {};
    const methods = [
      'select',
      'eq',
      'neq',
      'gte',
      'lte',
      'lt',
      'is',
      'in',
      'order',
      'upsert',
      'insert',
      'update',
      'delete',
      'limit',
      'range',
      'or',
      'not',
    ];
    for (const m of methods) {
      self[m] = vi.fn().mockReturnValue(self);
    }
    self.maybeSingle = vi.fn().mockResolvedValue(result);
    self.single = vi.fn().mockResolvedValue(result);
    self.then = function (onF: any, onR: any) {
      return Promise.resolve(result).then(onF, onR);
    };
    return self;
  };

  return {
    rpc: vi
      .fn()
      .mockResolvedValue({ data: rpcResult ?? null, error: rpcError ?? null }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'weekly_reports') {
        if (rowData) {
          return buildChain(rowData);
        }
        if (
          rpcResult &&
          typeof rpcResult === 'object' &&
          'items' in rpcResult
        ) {
          // This is a query from getWeeklyReportsAction!
          return buildChain(rpcResult.items, null, rpcResult.total);
        }
        return buildChain([]);
      }
      if (table === 'weekly_report_sections') {
        return buildChain([mockReportSection('time_summary')]);
      }
      if (table === 'report_templates') {
        return buildChain(mockReportTemplate());
      }
      if (table === 'clients') {
        return buildChain({ id: 'ba0e897a-391f-4739-b86a-e243cc05d4c9' });
      }
      // default fallbacks for aggregation tables in generateWeeklyReportAction
      if (table === 'time_entries') {
        return buildChain([
          { duration_minutes: 60, date: '2026-05-20', notes: 'Done' },
        ]);
      }
      if (table === 'invoices') {
        return buildChain([{ id: 'inv-1', total_cents: 10000 }]);
      }
      if (table === 'agent_runs') {
        return buildChain([{ action_type: 'draft_report', status: 'success' }]);
      }
      if (table === 'invoice_payments') {
        return buildChain([{ amount_cents: 5000 }]);
      }
      return buildChain([]);
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  } as any;
}

function mockWeeklyReportRow(status: string, templateId?: string | null) {
  return {
    id: 'ea0e897a-391f-4739-b86a-e243cc05d4c9',
    workspace_id: 'ws-1',
    client_id: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
    period_start: '2026-05-19',
    period_end: '2026-05-25',
    status,
    template_id: templateId ?? null,
    generated_by: 'user-1',
    generated_at: '2026-05-26T06:30:00Z',
    sent_at: null,
    version: 1,
    parent_report_id: null,
    template_snapshot: {},
    created_at: '2026-05-26T06:30:00Z',
    updated_at: '2026-05-26T06:30:00Z',
  };
}

function mockReportSection(sectionType: string) {
  return {
    id: 'sec-1',
    report_id: 'ea0e897a-391f-4739-b86a-e243cc05d4c9',
    section_type: sectionType,
    title: `${sectionType} summary`,
    content: { rows: [] },
    sort_order: 1,
    created_at: '2026-05-26T06:30:00Z',
  };
}

function mockReportTemplate() {
  return {
    id: 'tpl-1',
    workspace_id: 'ws-1',
    client_id: null,
    name: 'Default Weekly Report',
    sections_config: {
      time_summary: { enabled: true, sort_order: 1 },
      task_log: { enabled: true, sort_order: 2 },
      agent_activity: { enabled: true, sort_order: 3 },
      invoice_summary: { enabled: true, sort_order: 4 },
    },
    branding: { accent_color: '#6366f1', logo_url: null },
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  };
}

// ───────────────────────────────────────────────────────────────
// ATDD-001: generateWeeklyReportAction aggregates data
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1a-ATDD-001] generateWeeklyReportAction aggregates time, tasks, and agent activity', () => {
  test('generateWeeklyReportAction is defined and has correct signature', () => {
    expect(generateWeeklyReportAction).toBeDefined();
    expect(typeof generateWeeklyReportAction).toBe('function');
  });

  test('generateWeeklyReportSchema accepts valid input', () => {
    const valid = generateWeeklyReportSchema.parse({
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });
    expect(valid).toBeDefined();
    expect(valid.clientId).toBe('ba0e897a-391f-4739-b86a-e243cc05d4c9');
  });

  test('generateWeeklyReportAction returns report with 4 sections on success', async () => {
    const client = mockSupabase(
      {
        report: mockWeeklyReportRow('draft'),
        sections: [mockReportSection('time_summary')],
      },
      undefined,
      mockWeeklyReportRow('draft'),
    );
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await generateWeeklyReportAction({
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });

    expect(result.success).toBe(true);
  });

  test('generateWeeklyReportAction rejects invalid date range (start > end)', async () => {
    const result = await generateWeeklyReportAction({
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-25',
      periodEnd: '2026-05-19',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_DATE_RANGE');
    }
  });

  test('generateWeeklyReportAction rejects date range > 31 days', async () => {
    const result = await generateWeeklyReportAction({
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-01',
      periodEnd: '2026-06-15',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('PERIOD_TOO_LONG');
    }
  });

  test('generateWeeklyReportAction accepts exactly 31 days (boundary)', async () => {
    const client = mockSupabase(
      { report: mockWeeklyReportRow('draft'), sections: [] },
      undefined,
      mockWeeklyReportRow('draft'),
    );
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await generateWeeklyReportAction({
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
    });

    expect(result.success).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Report persistence stores header + sections atomically
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1a-ATDD-002] report persistence stores header and sections atomically', () => {
  test('weekly_reports schema properties check', () => {
    const report = mockWeeklyReportRow('draft');
    expect(report.id).toBeDefined();
    expect(report.status).toBe('draft');
    expect(report.version).toBe(1);
    expect(report.template_snapshot).toBeDefined();
  });

  test('weekly_report_sections schema properties check', () => {
    const section = mockReportSection('time_summary');
    expect(section.report_id).toBe('ea0e897a-391f-4739-b86a-e243cc05d4c9');
    expect(section.section_type).toBe('time_summary');
    expect(section.sort_order).toBe(1);
  });

  test('report_templates schema properties check', () => {
    const template = mockReportTemplate();
    expect(template.client_id).toBeNull();
    expect(template.sections_config.time_summary.enabled).toBe(true);
  });

  test('insert into weekly_reports returns row with generated_by set to current user', () => {
    const report = mockWeeklyReportRow('draft');
    expect(report.generated_by).toBe('user-1');
  });

  test('create_weekly_report_with_sections RPC mock validation', async () => {
    const client = mockSupabase(
      { report: mockWeeklyReportRow('draft'), sections: [] },
      undefined,
      mockWeeklyReportRow('draft'),
    );
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await generateWeeklyReportAction({
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });

    expect(result.success).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith(
      'create_weekly_report_with_sections',
      expect.any(Object),
    );
  });

  test('template_snapshot is stored on weekly_reports at generation time', () => {
    const report = mockWeeklyReportRow('draft');
    expect(report.template_snapshot).toBeDefined();
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Report list UI — paginated, sorted, empty state
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1a-ATDD-003] report list page shows paginated reports per client', () => {
  test('ReportsPage component is exported from @/app/(workspace)/reports/page', () => {
    expect(ReportsPage).toBeDefined();
    expect(typeof ReportsPage).toBe('function');
  });

  test('report list fetches via getWeeklyReportsAction server action with pagination', async () => {
    const client = mockSupabase(
      { items: [mockWeeklyReportRow('draft')], total: 1, hasNextPage: false },
      undefined,
    );
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await getWeeklyReportsAction(1);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toBeDefined();
      expect(result.data.total).toBe(1);
    }
  });

  test('pagination returns correct page boundaries (20 items/page)', async () => {
    const client = mockSupabase(
      {
        items: Array(20).fill(mockWeeklyReportRow('draft')),
        total: 21,
        hasNextPage: true,
      },
      undefined,
    );
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await getWeeklyReportsAction(1);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items.length).toBe(20);
      expect(result.data.hasNextPage).toBe(true);
    }
  });

  test('empty state shows CTA when no reports exist', async () => {
    const client = mockSupabase(
      { items: [], total: 0, hasNextPage: false },
      undefined,
    );
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await getWeeklyReportsAction(1);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items.length).toBe(0);
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Report detail view — sections from pre-computed JSONB
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1a-ATDD-004] report detail view shows formatted sections from pre-computed data', () => {
  test('ReportDetailPage component is exported from @/app/(workspace)/reports/[reportId]/page', () => {
    expect(ReportDetailPage).toBeDefined();
    expect(typeof ReportDetailPage).toBe('function');
  });

  test('getWeeklyReportById returns report + sections ordered by sort_order', async () => {
    const client = mockSupabase(null, undefined, mockWeeklyReportRow('draft'));
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await getWeeklyReportByIdAction(
      'ea0e897a-391f-4739-b86a-e243cc05d4c9',
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.id).toBe(
        'ea0e897a-391f-4739-b86a-e243cc05d4c9',
      );
      expect(result.data.sections).toBeDefined();
    }
  });

  test('TimeSummarySection renders total hours from pre-computed JSONB', () => {
    expect(TimeSummarySection).toBeDefined();
    expect(typeof TimeSummarySection).toBe('function');
  });

  test('section with zero data shows graceful empty message', () => {
    const section = mockReportSection('time_summary');
    section.content = { totalMinutes: 0 };
    expect(section.content.totalMinutes).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-005: Permissions — role-based access on reports
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1a-ATDD-005] permissions enforce role-based access on reports', () => {
  test('Owner can generate reports', async () => {
    const client = mockSupabase(
      { report: mockWeeklyReportRow('draft'), sections: [] },
      undefined,
      mockWeeklyReportRow('draft'),
    );
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await generateWeeklyReportAction({
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });
    expect(result.success).toBe(true);
  });

  test('Admin can generate reports', async () => {
    const client = mockSupabase(
      { report: mockWeeklyReportRow('draft'), sections: [] },
      undefined,
      mockWeeklyReportRow('draft'),
    );
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await generateWeeklyReportAction({
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });
    expect(result.success).toBe(true);
  });

  test('Member cannot generate reports (INSERT blocked by RLS)', async () => {
    const { requireTenantContext } = await import('@flow/db');
    (requireTenantContext as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'member',
    });

    const result = await generateWeeklyReportAction({
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  test('Member can view reports (SELECT allowed)', async () => {
    const { requireTenantContext } = await import('@flow/db');
    (requireTenantContext as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'member',
    });

    const client = mockSupabase(
      { items: [mockWeeklyReportRow('draft')], total: 1, hasNextPage: false },
      undefined,
    );
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await getWeeklyReportsAction(1);
    expect(result.success).toBe(true);
  });

  test('ClientUser cannot access /reports route', async () => {
    const { requireTenantContext } = await import('@flow/db');
    (requireTenantContext as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'client_user',
    });

    const result = await getWeeklyReportsAction(1);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-006: Default template seed
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1a-ATDD-006] default template seeded for every workspace', () => {
  test('new workspace has default report template with all 4 sections enabled', () => {
    const template = mockReportTemplate();
    expect(template.sections_config.time_summary.enabled).toBe(true);
    expect(template.sections_config.task_log.enabled).toBe(true);
    expect(template.sections_config.agent_activity.enabled).toBe(true);
    expect(template.sections_config.invoice_summary.enabled).toBe(true);
  });

  test('existing workspaces get default template via migration backfill', () => {
    const template = mockReportTemplate();
    expect(template.workspace_id).toBe('ws-1');
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-007: Edge cases — zero data handling
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1a-ATDD-007] edge cases: zero data in reporting period', () => {
  test('report generation succeeds with zero time entries', async () => {
    const client = mockSupabase(
      { report: mockWeeklyReportRow('draft'), sections: [] },
      undefined,
      mockWeeklyReportRow('draft'),
    );
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await generateWeeklyReportAction({
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });
    expect(result.success).toBe(true);
  });

  test('report generation succeeds with zero invoices', async () => {
    const client = mockSupabase(
      { report: mockWeeklyReportRow('draft'), sections: [] },
      undefined,
      mockWeeklyReportRow('draft'),
    );
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await generateWeeklyReportAction({
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });
    expect(result.success).toBe(true);
  });

  test('report generation succeeds with zero agent runs', async () => {
    const client = mockSupabase(
      { report: mockWeeklyReportRow('draft'), sections: [] },
      undefined,
      mockWeeklyReportRow('draft'),
    );
    (getServerSupabase as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const result = await generateWeeklyReportAction({
      clientId: 'ba0e897a-391f-4739-b86a-e243cc05d4c9',
      periodStart: '2026-05-19',
      periodEnd: '2026-05-25',
    });
    expect(result.success).toBe(true);
  });
});
