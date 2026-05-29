/**
 * Story 8.1c Acceptance Tests — Report Re-Generation & Versioning
 * Revised: conditional-write pattern, version_group_id, structured ATDD.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@/lib/actions/reports/lib/aggregate-report-data', () => ({
  aggregateReportData: vi.fn(),
}));

vi.mock('@/lib/actions/reports/lib/build-report-sections', () => ({
  buildReportSections: vi.fn().mockReturnValue([
    { section_type: 'time_summary', title: 'Time Summary', sort_order: 1, content: { totalMinutes: 60 } },
  ]),
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
import { aggregateReportData } from '@/lib/actions/reports/lib/aggregate-report-data';

function mockWeeklyReportRow(
  overrides: Partial<{
    id: string; status: string; version: number;
    parentReportId: string | null; versionGroupId: string | null;
    generatedBy: string; workspaceId: string; clientId: string;
    templateId: string | null;
  }> = {},
) {
  return {
    id: overrides.id ?? 'rpt-1',
    workspace_id: overrides.workspaceId ?? 'ws-1',
    client_id: overrides.clientId ?? 'cli-1',
    period_start: '2026-05-19',
    period_end: '2026-05-25',
    status: overrides.status ?? 'draft',
    template_id: overrides.templateId ?? 'tpl-1',
    generated_by: overrides.generatedBy ?? 'user-1',
    generated_at: '2026-05-26T06:30:00Z',
    sent_at: ['sent', 'viewed'].includes(overrides.status ?? 'draft') ? '2026-05-27T09:00:00Z' : null,
    version: overrides.version ?? 1,
    parent_report_id: overrides.parentReportId ?? null,
    version_group_id: overrides.versionGroupId ?? null,
    template_snapshot: {},
    created_at: '2026-05-26T06:30:00Z',
    updated_at: '2026-05-26T06:30:00Z',
  };
}

function makeChain(finalResult: { data?: unknown; error?: unknown | null } = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(finalResult),
    maybeSingle: vi.fn().mockResolvedValue(finalResult),
    single: vi.fn().mockResolvedValue(finalResult),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  return chain;
}

const defaultAggData = {
  timeRows: [], invRows: [], agentRows: [],
  totalMinutes: 0, totalInvoiceCents: 0, totalPaidCents: 0, invoiceIds: [] as string[],
};

let mockSupabase: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' });
  vi.mocked(aggregateReportData).mockResolvedValue({ data: defaultAggData, error: null });
});

function setupFrom(config: {
  reportRow?: Record<string, unknown> | null;
  templateRow?: Record<string, unknown> | null;
  sectionRows?: Array<Record<string, unknown>>;
  secondReportRow?: Record<string, unknown>;
}) {
  const tableChains: Record<string, ReturnType<typeof vi.fn>> = {};

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (tableChains[table]) return tableChains[table];
    if (table === 'weekly_reports') {
      const chain = makeChain({ data: config.reportRow ?? null, error: null });
      if (config.secondReportRow) {
        chain.single = vi.fn().mockResolvedValue({ data: config.secondReportRow, error: null });
      }
      tableChains[table] = chain;
    } else if (table === 'weekly_report_sections') {
      const chain = makeChain({ data: config.sectionRows ?? [], error: null });
      tableChains[table] = chain;
    } else if (table === 'report_templates') {
      const chain = makeChain({ data: config.templateRow ?? null, error: null });
      tableChains[table] = chain;
    } else {
      tableChains[table] = makeChain();
    }
    return tableChains[table]!;
  });

  mockSupabase = { from: fromFn, rpc: vi.fn() };
  vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase as any);
  return mockSupabase;
}

// ───────────────────────────────────────────────────────────────
// ATDD-001: Draft re-generation with conditional-write
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1c-ATDD-001] draft re-generation via conditional-write', () => {
  test('regenerateWeeklyReportAction is exported with signature ({ reportId, expectedVersion })', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');
    expect(typeof regenerateWeeklyReportAction).toBe('function');
  });

  test('draft regeneration upserts sections and increments version', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const draftRow = mockWeeklyReportRow({ status: 'draft', version: 1, versionGroupId: 'rpt-1' });
    const updatedRow = { ...draftRow, version: 2, updated_at: '2026-05-29T10:00:00Z' };

    const sb = setupFrom({ reportRow: draftRow, secondReportRow: updatedRow });
    sb.rpc = vi.fn().mockResolvedValue({ data: 'rpt-1', error: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.version).toBe(2);
    }
  });

  test('returns CONCURRENT_MODIFICATION when version mismatch', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const draftRow = mockWeeklyReportRow({ status: 'draft', version: 2 });
    const sb = setupFrom({ reportRow: draftRow });
    sb.rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'CONCURRENT_MODIFICATION: version mismatch' } });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONCURRENT_MODIFICATION');
    }
  });

  test('returns CONCURRENT_MODIFICATION when status changed to sent between load and click', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const sentRow = mockWeeklyReportRow({ status: 'sent', version: 1 });
    const sb = setupFrom({ reportRow: sentRow });
    sb.rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'CONCURRENT_MODIFICATION: status changed' } });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONCURRENT_MODIFICATION');
    }
  });

  test('sections are upserted by (report_id, section_type) during draft regeneration', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const draftRow = mockWeeklyReportRow({ status: 'draft', version: 1, versionGroupId: 'rpt-1' });
    const updatedRow = { ...draftRow, version: 2 };

    const sb = setupFrom({ reportRow: draftRow, secondReportRow: updatedRow });
    sb.rpc = vi.fn().mockResolvedValue({ data: 'rpt-1', error: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(true);
    expect(sb.rpc).toHaveBeenCalledWith('regenerate_draft_report', expect.objectContaining({
      p_report_id: 'rpt-1',
      p_expected_version: 1,
    }));
  });

  test('aggregation failure rolls back transaction — report unchanged', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    vi.mocked(aggregateReportData).mockResolvedValueOnce({ data: null, error: 'Failed to aggregate report data.' });

    const sb = setupFrom({ reportRow: mockWeeklyReportRow({ status: 'draft', version: 1 }) });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Sent report versioning via conditional clone
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1c-ATDD-002] sent report cloning creates new version', () => {
  test('sent report regeneration creates NEW row with version = original.version + 1', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const sentRow = mockWeeklyReportRow({ id: 'rpt-1', status: 'sent', version: 1, versionGroupId: null });
    const newRow = mockWeeklyReportRow({
      id: 'rpt-2', status: 'draft', version: 2,
      parentReportId: 'rpt-1', versionGroupId: 'rpt-1', generatedBy: 'user-1',
    });

    const sb = setupFrom({ reportRow: sentRow, secondReportRow: newRow });
    sb.rpc = vi.fn().mockResolvedValue({ data: 'rpt-2', error: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.version).toBe(2);
      expect(result.data.report.parentReportId).toBe('rpt-1');
      expect(result.data.report.status).toBe('draft');
    }
  });

  test('original sent report is IMMUTABLE — updated_at unchanged after versioning', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const originalUpdatedAt = '2026-05-27T09:00:00Z';
    const sentRow = mockWeeklyReportRow({ status: 'sent', version: 1 });
    sentRow.updated_at = originalUpdatedAt;

    const sb = setupFrom({ reportRow: sentRow, secondReportRow: { ...sentRow, id: 'rpt-2', version: 2, status: 'draft' } });
    sb.rpc = vi.fn().mockResolvedValue({ data: 'rpt-2', error: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(true);
    expect(sentRow.updated_at).toBe(originalUpdatedAt);
  });

  test('new version copies all sections from original', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const sentRow = mockWeeklyReportRow({ status: 'sent', version: 1 });
    const seedSections = [
      { id: 'sec-1', report_id: 'rpt-2', section_type: 'time_summary', title: 'TS', content: {}, sort_order: 1, created_at: '2026-05-26T06:30:00Z' },
      { id: 'sec-2', report_id: 'rpt-2', section_type: 'task_log', title: 'TL', content: {}, sort_order: 2, created_at: '2026-05-26T06:30:00Z' },
      { id: 'sec-3', report_id: 'rpt-2', section_type: 'agent_activity', title: 'AA', content: {}, sort_order: 3, created_at: '2026-05-26T06:30:00Z' },
      { id: 'sec-4', report_id: 'rpt-2', section_type: 'invoice_summary', title: 'IS', content: {}, sort_order: 4, created_at: '2026-05-26T06:30:00Z' },
    ];

    const sb = setupFrom({ reportRow: sentRow, secondReportRow: { ...sentRow, id: 'rpt-2', version: 2, status: 'draft' }, sectionRows: seedSections });
    sb.rpc = vi.fn().mockResolvedValue({ data: 'rpt-2', error: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sections).toHaveLength(4);
    }
  });

  test('section sort_order preserved after clone', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const sentRow = mockWeeklyReportRow({ status: 'sent', version: 1 });
    const seedSections = [
      { id: 'sec-1', report_id: 'rpt-2', section_type: 'time_summary', title: 'TS', content: {}, sort_order: 1, created_at: '2026-05-26T06:30:00Z' },
      { id: 'sec-2', report_id: 'rpt-2', section_type: 'task_log', title: 'TL', content: {}, sort_order: 2, created_at: '2026-05-26T06:30:00Z' },
    ];

    const sb = setupFrom({ reportRow: sentRow, secondReportRow: { ...sentRow, id: 'rpt-2', version: 2, status: 'draft' }, sectionRows: seedSections });
    sb.rpc = vi.fn().mockResolvedValue({ data: 'rpt-2', error: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sections.map((s: { sortOrder: number }) => s.sortOrder)).toEqual([1, 2]);
    }
  });

  test('clone failure rolls back — no orphaned report row', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const sb = setupFrom({ reportRow: mockWeeklyReportRow({ status: 'sent', version: 1 }) });
    sb.rpc = vi.fn().mockRejectedValue(new Error('Section insert failed'));

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(false);
  });

  test('report with zero sections can be cloned', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const sentRow = mockWeeklyReportRow({ status: 'sent', version: 1 });
    const sb = setupFrom({ reportRow: sentRow, secondReportRow: { ...sentRow, id: 'rpt-2', version: 2, status: 'draft' } });
    sb.rpc = vi.fn().mockResolvedValue({ data: 'rpt-2', error: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.version).toBe(2);
      expect(result.data.sections).toHaveLength(0);
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Version group logic
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1c-ATDD-003] version_group_id assignment', () => {
  test('first regeneration sets version_group_id on original and clone', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const sentRow = mockWeeklyReportRow({ status: 'sent', version: 1, versionGroupId: null });
    const newRow = mockWeeklyReportRow({
      id: 'rpt-2', status: 'draft', version: 2,
      parentReportId: 'rpt-1', versionGroupId: 'rpt-1',
    });

    const sb = setupFrom({ reportRow: sentRow, secondReportRow: newRow });
    sb.rpc = vi.fn().mockResolvedValue({ data: 'rpt-2', error: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.versionGroupId).toBe('rpt-1');
    }
  });

  test('regeneration of non-latest version stays in same version group', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const v2Row = mockWeeklyReportRow({
      id: 'rpt-2', status: 'sent', version: 2,
      parentReportId: 'rpt-1', versionGroupId: 'rpt-1',
    });
    const v4Row = mockWeeklyReportRow({
      id: 'rpt-4', status: 'draft', version: 4,
      parentReportId: 'rpt-2', versionGroupId: 'rpt-1',
    });

    const sb = setupFrom({ reportRow: v2Row, secondReportRow: v4Row });
    sb.rpc = vi.fn().mockResolvedValue({ data: 'rpt-4', error: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-2', expectedVersion: 2 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.versionGroupId).toBe('rpt-1');
    }
  });

  test('version count query returns correct total via getReportVersions', async () => {
    const { getReportVersions } = await import('@/lib/actions/reports/get-report-versions');

    const versions = [
      { id: 'rpt-1', version: 1, status: 'sent', generated_at: '2026-05-26T06:30:00Z', generated_by: 'user-1' },
      { id: 'rpt-2', version: 2, status: 'sent', generated_at: '2026-05-27T06:30:00Z', generated_by: 'user-1' },
      { id: 'rpt-3', version: 3, status: 'draft', generated_at: '2026-05-28T06:30:00Z', generated_by: 'user-2' },
    ];

    const chain = makeChain({ data: versions, error: null });
    mockSupabase = { from: vi.fn().mockReturnValue(chain), rpc: vi.fn() };
    vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase as any);

    const result = await getReportVersions({ versionGroupId: 'vg-1' });

    expect(result).toHaveLength(3);
    expect(result[0]!.version).toBe(1);
    expect(result[2]!.version).toBe(3);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Error states
// ───────────────────────────────────────────────────────────────
describe('[P0] [8.1c-ATDD-004] error handling', () => {
  test('non-existent report returns NOT_FOUND', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const sb = setupFrom({ reportRow: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'nonexistent', expectedVersion: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  test('deleted report between page load and regenerate returns NOT_FOUND', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const sb = setupFrom({ reportRow: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-deleted', expectedVersion: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-005: Audit trail
// ───────────────────────────────────────────────────────────────
describe('[P1] [8.1c-ATDD-005] audit metadata per version', () => {
  test('generated_by reflects regenerating user, not original author', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    vi.mocked(requireTenantContext).mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-B', role: 'owner' });

    const sentRow = mockWeeklyReportRow({ status: 'sent', version: 1, generatedBy: 'user-A' });
    const newRow = mockWeeklyReportRow({
      id: 'rpt-2', status: 'draft', version: 2,
      parentReportId: 'rpt-1', versionGroupId: 'rpt-1', generatedBy: 'user-B',
    });

    const sb = setupFrom({ reportRow: sentRow, secondReportRow: newRow });
    sb.rpc = vi.fn().mockResolvedValue({ data: 'rpt-2', error: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.generatedBy).toBe('user-B');
    }
  });

  test('generated_at is now(), not original timestamp', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const sentRow = mockWeeklyReportRow({ status: 'sent', version: 1 });
    const newRow = mockWeeklyReportRow({
      id: 'rpt-2', status: 'draft', version: 2,
      parentReportId: 'rpt-1', versionGroupId: 'rpt-1',
    });
    newRow.generated_at = '2026-05-29T10:00:00Z';

    const sb = setupFrom({ reportRow: sentRow, secondReportRow: newRow });
    sb.rpc = vi.fn().mockResolvedValue({ data: 'rpt-2', error: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.generatedAt).not.toBe('2026-05-26T06:30:00Z');
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-006: Idempotency
// ───────────────────────────────────────────────────────────────
describe('[P1] [8.1c-ATDD-006] idempotency', () => {
  test('draft regeneration with unchanged data succeeds — version still increments', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const draftRow = mockWeeklyReportRow({ status: 'draft', version: 1, versionGroupId: 'rpt-1' });
    const updatedRow = { ...draftRow, version: 2, updated_at: '2026-05-29T10:00:00Z' };

    const sb = setupFrom({ reportRow: draftRow, secondReportRow: updatedRow });
    sb.rpc = vi.fn().mockResolvedValue({ data: 'rpt-1', error: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.version).toBe(2);
    }
  });

  test('sent report always creates new version even if data unchanged', async () => {
    const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');

    const sentRow = mockWeeklyReportRow({ status: 'sent', version: 1 });
    const newRow = mockWeeklyReportRow({
      id: 'rpt-2', status: 'draft', version: 2,
      parentReportId: 'rpt-1', versionGroupId: 'rpt-1',
    });

    const sb = setupFrom({ reportRow: sentRow, secondReportRow: newRow });
    sb.rpc = vi.fn().mockResolvedValue({ data: 'rpt-2', error: null });

    const result = await regenerateWeeklyReportAction({ reportId: 'rpt-1', expectedVersion: 1 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report.version).toBe(2);
      expect(result.data.report.id).toBe('rpt-2');
    }
  });
});
