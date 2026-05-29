import { createServiceClient } from '@flow/db';
import type { WeeklyReportInput, WeeklyReportProposal } from './schemas';
import { processClientReport } from './process-client-report';

interface ExecuteOptions {
  persist?: boolean;
}

export async function execute(
  input: WeeklyReportInput,
  options?: ExecuteOptions,
): Promise<WeeklyReportProposal & { sectionsPayload?: unknown[] }> {
  const supabase = createServiceClient();
  return processClientReport(supabase, input, options);
}
