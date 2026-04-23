import type { WeeklyReportProposal } from './schemas';

export async function preCheck(_proposal: WeeklyReportProposal): Promise<{
  passed: boolean;
  errors: string[];
}> {
  throw new Error('weekly-report.preCheck not implemented');
}
