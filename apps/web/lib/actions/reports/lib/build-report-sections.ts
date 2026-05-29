const SECTION_ORDER: Array<{ type: string; title: string }> = [
  { type: 'time_summary', title: 'Time Summary' },
  { type: 'task_log', title: 'Task Log' },
  { type: 'agent_activity', title: 'Agent Activity' },
  { type: 'invoice_summary', title: 'Invoice Summary' },
];

function safeNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

export interface AggregatedData {
  timeRows: Array<Record<string, unknown>>;
  invRows: Array<Record<string, unknown>>;
  agentRows: Array<Record<string, unknown>>;
  totalMinutes: number;
  totalInvoiceCents: number;
  totalPaidCents: number;
  invoiceIds: string[];
}

export function buildReportSections(
  aggregated: AggregatedData,
  templateSnapshot: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const sectionsConfig = (templateSnapshot.sections_config as Record<string, { enabled?: boolean; sort_order?: number }> | undefined) ?? {};
  const fallbackOrder = ['time_summary', 'task_log', 'agent_activity', 'invoice_summary'] as const;
  const hasEnabledConfig = Object.keys(sectionsConfig).length > 0;

  const orderedSections = hasEnabledConfig
    ? (Object.entries(sectionsConfig)
        .filter(([, cfg]) => cfg?.enabled)
        .sort(([, a], [, b]) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0))
        .map(([type]) => type))
    : fallbackOrder.map((t) => t);

  const sectionOrderMap = new Map<string, number>();
  for (const [type, cfg] of Object.entries(sectionsConfig)) {
    sectionOrderMap.set(type, cfg?.sort_order ?? 0);
  }

  const { timeRows, agentRows, totalMinutes, totalInvoiceCents, totalPaidCents, invoiceIds } = aggregated;
  const sectionsPayload: Array<Record<string, unknown>> = [];

  for (const secType of orderedSections) {
    const sectionDef = SECTION_ORDER.find((s) => s.type === secType)!;
    let content: Record<string, unknown> = {};

    if (secType === 'time_summary') {
      content = { totalMinutes };
    } else if (secType === 'task_log') {
      const projectMap = new Map<string, { projectName: string; entries: Array<{ date: string; durationMinutes: number; notes: string }> }>();
      for (const r of timeRows) {
        const pid = safeStr(r.project_id);
        const pname = ((r.projects as { name?: string } | null | undefined)?.name) ?? '';
        if (!projectMap.has(pid)) {
          projectMap.set(pid, { projectName: pname, entries: [] });
        }
        projectMap.get(pid)!.entries.push({
          date: safeStr(r.date),
          durationMinutes: safeNum(r.duration_minutes),
          notes: safeStr(r.notes),
        });
      }
      content = { projects: Array.from(projectMap.values()) };
    } else if (secType === 'agent_activity') {
      const counts = new Map<string, { actionType: string; status: string; count: number }>();
      for (const r of agentRows) {
        const actionType = (r.action_type as string) ?? '';
        const status = (r.status as string) ?? '';
        const key = JSON.stringify([actionType, status]);
        if (!counts.has(key)) {
          counts.set(key, { actionType, status, count: 0 });
        }
        counts.get(key)!.count++;
      }
      content = { runs: Array.from(counts.values()) };
    } else if (secType === 'invoice_summary') {
      content = {
        totalCents: totalInvoiceCents,
        amountPaidCents: totalPaidCents,
        invoiceCount: invoiceIds.length,
      };
    }

    sectionsPayload.push({
      section_type: secType,
      title: sectionDef.title,
      sort_order: sectionOrderMap.get(secType) ?? 0,
      content,
    });
  }

  return sectionsPayload;
}

export { SECTION_ORDER };
