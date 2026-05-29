import { createServiceClient } from '@flow/db';
import type { WeeklyReportInput, WeeklyReportProposal } from './schemas';
import { processClientReport } from './process-client-report';

/**
 * Standard agent execution entrypoint, called by orchestrator worker or manual trigger.
 */
export async function execute(input: WeeklyReportInput): Promise<WeeklyReportProposal> {
  const supabase = createServiceClient();
  return processClientReport(supabase, input);
}
