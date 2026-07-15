import { getAgentConfiguration } from '@flow/db';
import type { TimeIntegrityInput } from './schemas';
import { timeIntegrityInputSchema } from './schemas';

export interface PreCheckResult {
  passed: boolean;
  errors: string[];
}

/** Validates sweep inputs and confirms the agent activation record is readable. */
export async function preCheck(
  input: TimeIntegrityInput,
): Promise<PreCheckResult> {
  const errors: string[] = [];

  const parsed = timeIntegrityInputSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
    return { passed: false, errors };
  }

  const { workspaceId } = parsed.data;

  try {
    const config = await getAgentConfiguration(workspaceId, 'time-integrity');
    if (config === null) {
      // Agent not configured yet — not an error, sweep will exit early in executor
    }
  } catch (err: unknown) {
    errors.push(`Agent configuration unreadable: ${String(err)}`);
    return { passed: false, errors };
  }

  return { passed: true, errors: [] };
}
