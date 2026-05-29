import { getAgentConfiguration, createServiceClient } from '@flow/db';
import type { WeeklyReportInput, WeeklyReportProposal } from './schemas';

export interface PreCheckResult {
  passed: boolean;
  errors: string[];
}

/**
 * Validates agent run pre-requisites (active configuration, valid workspace subscription)
 * or checks proposal validity depending on argument type.
 */
export async function preCheck(
  input: WeeklyReportInput | WeeklyReportProposal
): Promise<PreCheckResult> {
  const errors: string[] = [];

  if ('clientId' in input) {
    // Input Mode
    const { workspaceId } = input;
    try {
      const config = await getAgentConfiguration(workspaceId, 'weekly-report');
      if (!config || config.status !== 'active') {
        errors.push(`Agent 'weekly-report' is inactive or not configured in workspace ${workspaceId}`);
      }

      // Check subscription active in workspaces settings
      const supabase = createServiceClient();
      const { data: ws, error: wsErr } = await supabase
        .from('workspaces')
        .select('id, settings')
        .eq('id', workspaceId)
        .single();
      
      if (wsErr || !ws) {
        errors.push(`Workspace not found: ${workspaceId}`);
      } else {
        const settings = (ws.settings as { subscriptionStatus?: string } | null) ?? {};
        if (settings.subscriptionStatus === 'suspended') {
          errors.push(`Workspace subscription is suspended`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Precheck validation query failed: ${msg}`);
    }
  } else {
    // Proposal Mode
    if (!input.title) {
      errors.push('Proposal title is missing');
    }
    if (typeof input.confidence !== 'number' || input.confidence < 0 || input.confidence > 1) {
      errors.push('Proposal confidence must be between 0 and 1');
    }
    if (!input.reasoning) {
      errors.push('Proposal reasoning is missing');
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
