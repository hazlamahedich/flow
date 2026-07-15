import { getAgentConfiguration, createServiceClient } from '@flow/db';
import type { ClientHealthInput } from './schemas';

export interface PreCheckResult {
  passed: boolean;
  errors: string[];
}

export async function preCheck(
  input: ClientHealthInput,
): Promise<PreCheckResult> {
  const errors: string[] = [];

  try {
    const config = await getAgentConfiguration(
      input.workspaceId,
      'client-health',
    );
    if (!config || config.status !== 'active') {
      errors.push(
        `Agent 'client-health' is inactive or not configured in workspace ${input.workspaceId}`,
      );
    }

    const supabase = createServiceClient();
    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .select('id, settings')
      .eq('id', input.workspaceId)
      .single();

    if (wsErr || !ws) {
      errors.push(`Workspace not found: ${input.workspaceId}`);
    } else {
      const settings =
        (ws.settings as { subscriptionStatus?: string } | null) ?? {};
      if (
        settings.subscriptionStatus === 'suspended' ||
        settings.subscriptionStatus === 'past_due'
      ) {
        errors.push(`Workspace subscription is ${settings.subscriptionStatus}`);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Precheck validation query failed: ${msg}`);
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
