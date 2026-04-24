import type { TrustLevel, AgentId } from './types';
import { RISK_WEIGHTS } from './risk-weights';

export type TrustEvent = 'success' | 'violation' | 'precheck_failure' | 'post_execution_violation';

export function calculateScoreChange(
  level: TrustLevel,
  event: TrustEvent,
  riskWeight: number,
): number {
  switch (event) {
    case 'success':
      return level === 'auto' ? 0 : 1;
    case 'violation':
      return -(10 * riskWeight);
    case 'precheck_failure':
      return -5;
    case 'post_execution_violation':
      return -20;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function applyScoreChange(currentScore: number, delta: number): number {
  return Math.max(0, Math.min(200, currentScore + delta));
}

export function getRiskWeight(agentId: AgentId, actionType: string): number {
  const key = `${agentId}:${actionType}` as `${AgentId}:${string}`;
  return RISK_WEIGHTS.get(key) ?? 1.0;
}
