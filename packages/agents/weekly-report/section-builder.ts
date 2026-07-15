import type { AggregatedReportData } from '@flow/db';

const SECTION_TITLE_MAP: Record<string, string> = {
  time_summary: 'Time Summary',
  task_log: 'Task Log',
  stalled_items: 'Stalled Items',
  agent_activity: 'Agent Activity',
  highlights: 'Highlights',
  invoice_summary: 'Invoice Summary',
};

export function buildSectionsPayload(
  activeSections: string[],
  narratives: Record<string, string>,
  aggregatedData: AggregatedReportData,
): unknown[] {
  return activeSections.map((secType, index) => {
    let baseContent: Record<string, unknown> = {};
    if (secType === 'time_summary')
      baseContent = { totalMinutes: aggregatedData.timeSummary.totalMinutes };
    else if (secType === 'task_log')
      baseContent = { projects: aggregatedData.taskLog.projects };
    else if (secType === 'agent_activity')
      baseContent = { runs: aggregatedData.agentActivity.runs };
    else if (secType === 'invoice_summary')
      baseContent = aggregatedData.invoiceSummary as unknown as Record<
        string,
        unknown
      >;
    else if (secType === 'stalled_items')
      baseContent = { items: aggregatedData.stalledItems };
    return {
      section_type: secType,
      title: SECTION_TITLE_MAP[secType] ?? secType,
      sort_order: index + 1,
      content: { ...baseContent, narrative: narratives[secType] ?? '' },
    };
  });
}

export function buildPreview(
  activeSections: string[],
  narratives: Record<string, string>,
): string {
  return activeSections
    .slice(0, 3)
    .map(
      (secType) =>
        `${SECTION_TITLE_MAP[secType] ?? secType}: ${narratives[secType] ?? ''}`,
    )
    .join('\n\n');
}
