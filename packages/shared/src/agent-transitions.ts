import type { AgentBackendStatus } from '@flow/types';

export const ALLOWED_TRANSITIONS: Record<AgentBackendStatus, AgentBackendStatus[]> = {
  inactive: ['activating', 'suspended'],
  activating: ['active', 'inactive', 'suspended'],
  active: ['draining', 'suspended'],
  draining: ['inactive', 'suspended'],
  suspended: ['inactive'],
};

export class AgentTransitionError extends Error {
  constructor(
    public readonly from: AgentBackendStatus,
    public readonly to: AgentBackendStatus,
    message?: string,
  ) {
    super(message ?? `Invalid transition: ${from} → ${to}`);
    this.name = 'AgentTransitionError';
  }
}

export function isValidTransition(
  from: AgentBackendStatus,
  to: AgentBackendStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: AgentBackendStatus,
  to: AgentBackendStatus,
): void {
  if (!isValidTransition(from, to)) {
    throw new AgentTransitionError(from, to);
  }
}
