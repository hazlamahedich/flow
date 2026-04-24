import type { AgentId, TrustDecision, TrustLevel } from '../types';
import { TrustTransitionError } from '../errors';
import { evaluatePreconditions } from '../pre-check';
import type { PreconditionEntry } from '../pre-check';
import { getRiskWeight } from '../scoring';
import { evaluateTransition } from '../graduation';

export interface MatrixEntry {
  id: string;
  workspace_id: string;
  agent_id: string;
  action_type: string;
  current_level: 'supervised' | 'confirm' | 'auto';
  score: number;
  total_executions: number;
  successful_executions: number;
  consecutive_successes: number;
  violation_count: number;
  last_transition_at: string;
  last_violation_at: string | null;
  cooldown_until: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TrustClientDeps {
  getTrustMatrixEntry: (workspaceId: string, agentId: string, actionType: string) => Promise<MatrixEntry | null>;
  upsertTrustMatrixEntry: (workspaceId: string, agentId: string, actionType: string) => Promise<MatrixEntry>;
  insertSnapshot: (entry: Record<string, unknown>) => Promise<{ id: string; created_at: string }>;
  getPreconditions: (workspaceId: string, agentId: string, actionType: string) => Promise<PreconditionEntry[]>;
  recordSuccess: (workspaceId: string, agentId: string, actionType: string, expectedVersion: number) => Promise<MatrixEntry>;
  recordViolation: (workspaceId: string, agentId: string, actionType: string, severity: 'soft' | 'hard', riskWeight: number, expectedVersion: number) => Promise<MatrixEntry>;
  insertTransition: (entry: Record<string, unknown>) => Promise<unknown>;
  generateId: () => string;
}

export interface TrustClient {
  canAct(agentId: AgentId, actionType: string, workspaceId: string, executionId: string, context: Record<string, unknown>): Promise<TrustDecision>;
  recordSuccess(snapshotId: string): Promise<void>;
  recordViolation(snapshotId: string, severity: 'soft' | 'hard'): Promise<void>;
}

export function createTrustClient(deps: TrustClientDeps): TrustClient {
  const snapshotCache = new Map<string, { entry: MatrixEntry; snapshotId: string }>();

  return {
    async canAct(agentId, actionType, workspaceId, executionId, context): Promise<TrustDecision> {
      try {
        const entry = await deps.upsertTrustMatrixEntry(workspaceId, agentId, actionType);
        const preconditions = await deps.getPreconditions(workspaceId, agentId, actionType);
        const preCheck = evaluatePreconditions(preconditions, context);

        const hashInput = `${entry.id}:${entry.version}:${executionId}`;
        const snapshotHash = hashInput;

        const snapshot = await deps.insertSnapshot({
          workspace_id: workspaceId,
          execution_id: executionId,
          agent_id: agentId,
          action_type: actionType,
          matrix_version: entry.version,
          level: entry.current_level,
          score: entry.score,
          snapshot_hash: snapshotHash,
        });

        snapshotCache.set(snapshot.id, { entry, snapshotId: snapshot.id });

        return {
          allowed: entry.current_level !== 'supervised' || preCheck.passed,
          level: entry.current_level,
          reason: preCheck.passed ? 'Trust check passed' : `Precondition failed: ${preCheck.failedKey ?? 'unknown'}`,
          snapshotId: snapshot.id,
          preconditionsPassed: preCheck.passed,
          failedPreconditionKey: preCheck.failedKey,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown trust query failure';
        return {
          allowed: false,
          level: 'supervised' as TrustLevel,
          reason: `Trust query failed: ${message}`,
          preconditionsPassed: true,
        };
      }
    },

    async recordSuccess(snapshotId): Promise<void> {
      const cached = snapshotCache.get(snapshotId);
      if (!cached) {
        throw new TrustTransitionError(
          'QUERY_FAILED',
          `Snapshot not found in cache: ${snapshotId}`,
          { retryable: false },
        );
      }

      const { entry } = cached;
      try {
        const updated = await deps.recordSuccess(
          entry.workspace_id,
          entry.agent_id,
          entry.action_type,
          entry.version,
        );

        const graduationCheck = evaluateTransition({
          currentLevel: updated.current_level,
          score: updated.score,
          consecutiveSuccesses: updated.consecutive_successes,
          totalAtCurrentLevel: updated.total_executions,
          cooldownUntil: updated.cooldown_until ? new Date(updated.cooldown_until) : null,
          lastViolationAt: updated.last_violation_at ? new Date(updated.last_violation_at) : null,
        });

        if (graduationCheck.canGraduate && graduationCheck.targetLevel) {
          await deps.insertTransition({
            matrix_entry_id: updated.id,
            workspace_id: updated.workspace_id,
            from_level: updated.current_level,
            to_level: graduationCheck.targetLevel,
            trigger_type: 'graduation',
            trigger_reason: graduationCheck.reason,
            is_context_shift: false,
            snapshot: { score: updated.score, consecutive: updated.consecutive_successes },
            actor: 'system:graduation',
          });
        }
      } catch (error) {
        if (error instanceof TrustTransitionError && error.code === 'CONCURRENT_MODIFICATION') {
          return;
        }
        throw error;
      }
    },

    async recordViolation(snapshotId, severity): Promise<void> {
      const cached = snapshotCache.get(snapshotId);
      if (!cached) {
        throw new TrustTransitionError(
          'QUERY_FAILED',
          `Snapshot not found in cache: ${snapshotId}`,
          { retryable: false },
        );
      }

      const { entry } = cached;
      const riskWeight = getRiskWeight(entry.agent_id as AgentId, entry.action_type);

      try {
        const updated = await deps.recordViolation(
          entry.workspace_id,
          entry.agent_id,
          entry.action_type,
          severity,
          riskWeight,
          entry.version,
        );

        await deps.insertTransition({
          matrix_entry_id: updated.id,
          workspace_id: updated.workspace_id,
          from_level: entry.current_level,
          to_level: updated.current_level,
          trigger_type: `${severity}_violation`,
          trigger_reason: `${severity} violation recorded (risk=${riskWeight})`,
          is_context_shift: false,
          snapshot: { score: updated.score, violations: updated.violation_count },
          actor: 'system:violation',
        });
      } catch (error) {
        if (error instanceof TrustTransitionError && error.code === 'CONCURRENT_MODIFICATION') {
          return;
        }
        throw error;
      }
    },
  };
}
