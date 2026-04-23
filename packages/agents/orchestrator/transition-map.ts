import type { AgentRunStatus } from '@flow/types';
import { VALID_RUN_TRANSITIONS } from '@flow/types';

export { VALID_RUN_TRANSITIONS };

export function isValidTransition(from: AgentRunStatus, to: AgentRunStatus): boolean {
  const allowed = VALID_RUN_TRANSITIONS[from];
  if (!allowed) return false;
  return (allowed as readonly string[]).includes(to);
}
