import type { AnomalyType } from './schemas';
import type { AnomalySignal } from './schemas';

const PROPOSAL_TITLES: Record<AnomalyType, string> = {
  'gap': 'Intra-day gap detected in time entries',
  'overlap': 'Overlapping time entries detected',
  'low-hours': 'Low-hours day detected',
};

export const PROPOSAL_REASONING: Record<AnomalyType, string> = {
  'gap': 'Two consecutive time entries have a gap exceeding the configured threshold. Review to ensure no billable time was missed.',
  'overlap': 'Two time entries on the same day have overlapping time ranges. This may indicate duplicate billing.',
  'low-hours': 'Total logged hours for this day are below the configured daily target. Consider whether any time was missed.',
};

export function buildProposalTitle(signal: AnomalySignal): string {
  const date = (signal.payload.date as string | undefined) ?? '';
  return `${PROPOSAL_TITLES[signal.anomalyType]}${date ? ` on ${date}` : ''}`;
}

export function subtractDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(Date.UTC(year!, month! - 1, day! - days));
  return d.toISOString().slice(0, 10);
}
