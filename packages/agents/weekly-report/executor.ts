import type { WeeklyReportInput, WeeklyReportProposal } from './schemas';

export async function execute(_input: WeeklyReportInput): Promise<WeeklyReportProposal> {
  throw new Error('weekly-report.execute not implemented');
}
