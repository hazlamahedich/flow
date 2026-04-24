import type { AgentId, TrustDecision } from '@flow/trust';
import type { TrustClient } from '@flow/trust';
import type { FlowError } from '@flow/types';
import { writeAuditLog } from '../shared/audit-writer';
import { TrustTransitionError } from '@flow/trust';

const CAN_ACT_TIMEOUT_MS = 500;

export type PreCheckResult =
  | { proceed: true; decision: TrustDecision }
  | { proceed: false; reason: 'precondition_failed' | 'trust_level_gate' | 'can_act_error'; decision?: TrustDecision; error?: FlowError };

export async function runPreCheck(
  trustClient: TrustClient,
  agentId: AgentId,
  actionType: string,
  workspaceId: string,
  executionId: string,
  context: Record<string, unknown>,
): Promise<PreCheckResult> {
  let decision: TrustDecision;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    decision = await Promise.race([
      trustClient.canAct(agentId, actionType, workspaceId, executionId, context),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('canAct timeout')), CAN_ACT_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : 'Unknown canAct failure';
    writeAuditLog({
      workspaceId,
      agentId,
      action: 'gate.pre_check.can_act_error',
      entityType: 'agent_run',
      entityId: executionId,
      details: { error: message, outcome: 'fail_safe_supervised' },
    });
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    return {
      proceed: false,
      reason: 'can_act_error',
    };
  }
  if (timeoutId !== undefined) clearTimeout(timeoutId);

  if (!isWellFormedDecision(decision)) {
    writeAuditLog({
      workspaceId,
      agentId,
      action: 'gate.pre_check.malformed_decision',
      entityType: 'agent_run',
      entityId: executionId,
      details: { decision, outcome: 'fail_safe_supervised' },
    });
    return { proceed: false, reason: 'can_act_error', decision };
  }

  if (decision.preconditionsPassed === false) {
    if (decision.snapshotId) {
      try {
        await trustClient.recordPrecheckFailure(decision.snapshotId);
      } catch (err) {
        if (!(err instanceof TrustTransitionError && err.code === 'CONCURRENT_MODIFICATION')) {
          writeAuditLog({
            workspaceId,
            agentId,
            action: 'gate.pre_check.record_failure_error',
            entityType: 'agent_run',
            entityId: executionId,
            details: { error: err instanceof Error ? err.message : String(err) },
          });
        }
      }
    }

    const error: FlowError = {
      status: 422,
      code: 'AGENT_PRECHECK_FAILED',
      message: decision.failedPreconditionKey
        ? `Precondition failed: ${decision.failedPreconditionKey}`
        : 'Precondition failed',
      category: 'agent',
      agentType: agentId,
      details: {
        failedPreconditionKey: decision.failedPreconditionKey,
        trustLevel: decision.level,
        runId: executionId,
        timestamp: new Date().toISOString(),
      },
    };

    return { proceed: false, reason: 'precondition_failed', decision, error };
  }

  if (decision.allowed === true && decision.level === 'auto') {
    return { proceed: true, decision };
  }

  return { proceed: false, reason: 'trust_level_gate', decision };
}

function isWellFormedDecision(d: TrustDecision): boolean {
  return (
    d !== null &&
    d !== undefined &&
    typeof d.allowed === 'boolean' &&
    typeof d.level === 'string'
  );
}

export async function blockForApproval(
  runId: string,
  decision: TrustDecision | undefined,
  reason: string,
  workspaceId: string,
  agentId: AgentId,
): Promise<void> {
  const { updateRunStatus } = await import('@flow/db');
  await updateRunStatus(runId, 'waiting_approval', {
    output: { _gate: { decision, reason } } as unknown as Record<string, unknown>,
  });

  writeAuditLog({
    workspaceId,
    agentId,
    action: 'gate.block_for_approval',
    entityType: 'agent_run',
    entityId: runId,
    details: { outcome: 'waiting_approval', reason },
  });
}
