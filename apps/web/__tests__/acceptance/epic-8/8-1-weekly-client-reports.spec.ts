/**
 * Story 8.1 Acceptance Tests — Weekly Client Reports
 * Tests report generation RPC, persistence, list/detail UI, templates, and re-generation.
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

function mockSupabase(rpcResult: unknown, rpcError?: Error, rowData?: unknown) {
  const fromChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: rowData ?? null, error: null }),
    single: vi.fn().mockResolvedValue({ data: rowData ?? null, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  return {
    rpc: vi
      .fn()
      .mockResolvedValue({ data: rpcResult, error: rpcError ?? null }),
    from: vi.fn().mockReturnValue(fromChain),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

function mockWeeklyReportRow(status: string, templateId?: string | null) {
  return {
    id: 'rpt-1',
    workspace_id: 'ws-1',
    client_id: 'cli-1',
    period_start: '2026-05-19',
    period_end: '2026-05-25',
    status,
    template_id: templateId ?? null,
    generated_at: '2026-05-26T06:30:00Z',
    sent_at: null,
    created_at: '2026-05-26T06:30:00Z',
    updated_at: '2026-05-26T06:30:00Z',
  };
}

function mockReportSection(sectionType: string) {
  return {
    id: 'sec-1',
    report_id: 'rpt-1',
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
    client_id: 'cli-1',
    name: 'Default Weekly Report',
    sections_config: {
      time_summary: { enabled: true, sort_order: 1 },
      task_log: { enabled: true, sort_order: 2 },
      agent_activity: { enabled: true, sort_order: 3 },
    },
    branding: { accent_color: '#D4A574', logo_url: null },
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  };
}

// ───────────────────────────────────────────────────────────────
// ATDD-001: generateWeeklyReport RPC aggregates data
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1-ATDD-001] generateWeeklyReport RPC aggregates time, tasks, and agent activity', () => {
  test.skip('generateWeeklyReportAction is defined and has correct signature', () => {
    // RED: Module @/lib/actions/reports/generate-weekly-report does not exist yet.
    // DEV: Create the server action exporting generateWeeklyReportAction({ clientId, periodStart, periodEnd, templateId? })
  });

  test.skip('generateWeeklyReportSchema accepts valid input', () => {
    // RED: Schema generateWeeklyReportSchema does not exist in @flow/types yet.
    // DEV: Add Zod schema with clientId (uuid), periodStart, periodEnd (ISO dates), optional templateId.
  });

  test.skip('generateWeeklyReportAction returns report with sections on success', () => {
    // RED: Action not implemented.
    // Given: mockSupabase returns { report: mockWeeklyReportRow('draft'), sections: [time_summary, task_log, agent_activity] }
    // Expect: result.success === true, result.data.sections.length === 3
  });

  test.skip('generateWeeklyReportAction rejects invalid date range', () => {
    // RED: Action not implemented.
    // Given: periodStart > periodEnd
    // Expect: result.success === false, result.error.code === 'INVALID_DATE_RANGE'
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Report persistence stores header + sections
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1-ATDD-002] report persistence stores header and sections in weekly_reports / weekly_report_sections', () => {
  test.skip('weekly_reports table exists with correct columns', () => {
    // RED: Migration for weekly_reports table not applied yet.
    // Expect: Table has columns: id, workspace_id, client_id, period_start, period_end, status, template_id, generated_at, sent_at
  });

  test.skip('weekly_report_sections table exists with correct columns', () => {
    // RED: Migration for weekly_report_sections table not applied yet.
    // Expect: Table has columns: id, report_id, section_type, title, content (JSONB), sort_order
  });

  test.skip('insert into weekly_reports returns the created report row', () => {
    // RED: Table not created yet.
    // Expect: Insert with valid data returns row with generated id
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Report list UI — user sees list per client
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1-ATDD-003] report list page shows generated reports per client', () => {
  test.skip('ReportListPage component is exported from @/app/(workspace)/reports/page', () => {
    // RED: Page component does not exist yet.
  });

  test.skip('report list fetches via getWeeklyReportsForClient server action', () => {
    // RED: Server action @/lib/actions/reports/get-weekly-reports does not exist yet.
    // DEV: Create getWeeklyReportsForClient({ clientId, page?, limit? }) returning paginated reports.
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Report detail view — formatted report with sections
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1-ATDD-004] report detail view shows formatted report with time summary, task log, and agent activity', () => {
  test.skip('ReportDetailPage component is exported from @/app/(workspace)/reports/[reportId]/page', () => {
    // RED: Page component does not exist yet.
  });

  test.skip('getWeeklyReportById server action returns report + sections', () => {
    // RED: Server action @/lib/actions/reports/get-weekly-report-by-id does not exist yet.
    // DEV: Create getWeeklyReportById({ reportId }) returning { report, sections }.
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-005: Report templates — customizable sections per client
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1-ATDD-005] report templates allow customizable sections per client', () => {
  test.skip('saveReportTemplateAction is defined', () => {
    // RED: Server action @/lib/actions/reports/save-report-template does not exist yet.
    // DEV: Create saveReportTemplateAction({ clientId, name, sectionsConfig, branding }) with upsert.
  });

  test.skip('saveReportTemplateSchema accepts valid template config', () => {
    // RED: Schema saveReportTemplateSchema does not exist in @flow/types yet.
    // DEV: Add Zod schema with sectionsConfig (Record<sectionType, { enabled: boolean, sortOrder: number }>) and branding.
  });

  test.skip('generateWeeklyReportAction respects template section enablement', () => {
    // RED: Action not implemented.
    // Given: template with task_log.enabled = false
    // Expect: generated report sections do NOT include task_log
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-006: Report re-generation for updated data
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1-ATDD-006] report re-generation updates existing report when data changes', () => {
  test.skip('regenerateWeeklyReportAction is defined', () => {
    // RED: Server action @/lib/actions/reports/regenerate-weekly-report does not exist yet.
    // DEV: Create regenerateWeeklyReportAction({ reportId }) that re-runs aggregation and updates sections.
  });

  test.skip('regenerateWeeklyReportAction returns updated sections', () => {
    // RED: Action not implemented.
    // Given: existing report with updated time entry data
    // Expect: result.success === true, updated_at > created_at
  });
});
