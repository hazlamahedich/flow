import type { PgBoss, Job } from 'pg-boss';
import type { AgentRunWorker } from './types';
import type { AgentId, AgentRunHandle, AgentRunResult, AgentProposal, FlowError } from '@flow/types';
import type { TrustClient } from '@flow/trust';
import type { OutputSchemaRegistry } from './output-schemas';
import { AgentJobPayloadSchema, type AgentJobPayload } from './schemas';
import { claimRunWithGuard, updateRunStatus, getRunById, createServiceClient } from '@flow/db';
import { writeAuditLog } from '../shared/audit-writer';
import { CircuitBreaker } from '../shared/circuit-breaker';
import { runPreCheck, blockForApproval } from './gates';
import { runPostCheck } from './post-check';
import { writeGateSignal } from './gate-events';
import type { PreCheckResult } from './gates';

const CAN_ACT_RETRY_DELAYS_MS = [1000, 5000, 15000];

async function persistSnapshotId(runId: string, snapshotId: string): Promise<void> {
  const client = createServiceClient();
  const { error } = await client.from('agent_runs').update({ trust_snapshot_id: snapshotId }).eq('id', runId);
  if (error) {
    writeAuditLog({ workspaceId: '', agentId: '', action: 'gate.persist_snapshot_error', entityType: 'agent_run', entityId: runId, details: { error: error.message, snapshotId } });
  }
}

function makePrecheckSignal(payload: { agentId: AgentId; actionType: string; runId: string; workspaceId: string }, decision: NonNullable<PreCheckResult['decision']>) {
  return {
    type: 'gate_pre_check_failed' as const,
    agentId: payload.agentId,
    actionType: payload.actionType,
    failedKey: decision.failedPreconditionKey ?? 'unknown',
    trustLevel: decision.level,
    runId: payload.runId,
    timestamp: new Date().toISOString(),
  };
}

function makePostcheckSignal(agentId: AgentId, actionType: string, constraint: string, runId: string) {
  return {
    type: 'gate_post_check_violation' as const, agentId, actionType,
    constraintViolated: constraint, outputRejected: true as const, runId,
    timestamp: new Date().toISOString(),
  };
}

export class PgBossWorker implements AgentRunWorker {
  private gateWarningLogged = false;

  constructor(
    private readonly boss: PgBoss,
    private readonly getCircuitBreaker: (agentId: AgentId) => CircuitBreaker | undefined,
    private readonly trustClient?: TrustClient,
    private readonly outputSchemaRegistry?: OutputSchemaRegistry,
  ) {}

  async claim(agentType: AgentId): Promise<AgentRunHandle | null> {
    const queueName = `agent:${agentType}`;
    const jobs = await this.boss.fetch(queueName);
    if (!jobs || jobs.length === 0) return null;

    const job = jobs[0] as Job<unknown>;
    const payload = AgentJobPayloadSchema.parse(job.data);

    const cb = this.getCircuitBreaker(agentType);
    if (cb && !cb.allowRequest()) {
      writeAuditLog({ workspaceId: payload.workspaceId, agentId: payload.agentId, action: 'claim.circuit_open', entityType: 'agent_run', entityId: payload.runId, details: { jobId: job.id, outcome: 'released' } });
      return null;
    }

    const updated = await claimRunWithGuard(payload.runId, job.id, { startedAt: new Date().toISOString() });
    if (!updated) {
      writeAuditLog({ workspaceId: payload.workspaceId, agentId: payload.agentId, action: 'claim.guard_reject', entityType: 'agent_run', entityId: payload.runId, details: { jobId: job.id, outcome: 'released' } });
      return null;
    }

    writeAuditLog({ workspaceId: payload.workspaceId, agentId: payload.agentId, action: 'claim', entityType: 'agent_run', entityId: payload.runId, details: { jobId: job.id, outcome: 'claimed' } });

    if (!this.trustClient) {
      if (!this.gateWarningLogged) {
        writeAuditLog({ workspaceId: payload.workspaceId, agentId: payload.agentId, action: 'gate.not_configured', entityType: 'orchestrator', details: { message: 'Trust gates not configured — agent actions running ungated', outcome: 'warn' } });
        this.gateWarningLogged = true;
      }
      return { runId: payload.runId, status: 'running' };
    }

    const preResult = await runPreCheck(this.trustClient, payload.agentId, payload.actionType, payload.workspaceId, payload.runId, payload.input);
    if (preResult.decision?.snapshotId) await persistSnapshotId(payload.runId, preResult.decision.snapshotId);

    if (!preResult.proceed) {
      if (preResult.reason === 'precondition_failed' && preResult.error) {
        try { if (preResult.decision) await writeGateSignal(makePrecheckSignal(payload, preResult.decision), payload.runId, payload.workspaceId); } catch { /* signal write failure is non-fatal */ }
        await this.fail(payload.runId, preResult.error);
        return null;
      }
      if (preResult.reason === 'can_act_error') {
        return await this.retryPreCheckOrFail(payload, preResult);
      }
      await blockForApproval(payload.runId, preResult.decision, preResult.reason, payload.workspaceId, payload.agentId);
      return null;
    }

    return { runId: payload.runId, status: 'running' };
  }

  private async retryPreCheckOrFail(payload: AgentJobPayload, initial: PreCheckResult): Promise<AgentRunHandle | null> {
    let result = initial;
    for (let attempt = 0; attempt < CAN_ACT_RETRY_DELAYS_MS.length; attempt++) {
      writeAuditLog({
        workspaceId: payload.workspaceId, agentId: payload.agentId,
        action: 'gate.pre_check.retry', entityType: 'agent_run', entityId: payload.runId,
        details: { attempt: attempt + 1, maxRetries: CAN_ACT_RETRY_DELAYS_MS.length, delayMs: CAN_ACT_RETRY_DELAYS_MS[attempt], outcome: 'retry_scheduled' },
      });
      await new Promise(resolve => setTimeout(resolve, CAN_ACT_RETRY_DELAYS_MS[attempt]));
      result = await runPreCheck(this.trustClient!, payload.agentId, payload.actionType, payload.workspaceId, payload.runId, payload.input);
      if (result.proceed) {
        if (result.decision?.snapshotId) await persistSnapshotId(payload.runId, result.decision.snapshotId);
        return { runId: payload.runId, status: 'running' };
      }
      if (!result.proceed && result.reason !== 'can_act_error') break;
    }
    if (!result.proceed && result.reason === 'precondition_failed' && result.error) {
      try { if (result.decision) await writeGateSignal(makePrecheckSignal(payload, result.decision), payload.runId, payload.workspaceId); } catch { /* non-fatal */ }
      await this.fail(payload.runId, result.error);
      return null;
    }
    if (!result.proceed && result.reason === 'trust_level_gate') {
      await blockForApproval(payload.runId, result.decision, result.reason, payload.workspaceId, payload.agentId);
      return null;
    }
    await blockForApproval(payload.runId, result.decision, 'can_act_retry_exhausted', payload.workspaceId, payload.agentId);
    writeAuditLog({
      workspaceId: payload.workspaceId, agentId: payload.agentId,
      action: 'gate.pre_check.retry_exhausted', entityType: 'agent_run', entityId: payload.runId,
      details: { outcome: 'waiting_approval', reason: 'can_act_retry_exhausted', retriesAttempted: CAN_ACT_RETRY_DELAYS_MS.length },
    });
    return null;
  }

  async complete(runId: string, result: AgentRunResult): Promise<void> {
    const run = await getRunById(runId);
    if (this.trustClient && this.outputSchemaRegistry) {
      const postResult = await runPostCheck(run.agent_id as AgentId, run.action_type, result.output, this.outputSchemaRegistry, runId, run.workspace_id, this.trustClient);
      if (!postResult.valid) {
        try { await writeGateSignal(makePostcheckSignal(run.agent_id as AgentId, run.action_type, postResult.zodErrors, runId), runId, run.workspace_id); } catch { /* non-fatal */ }
        await this.fail(runId, postResult.error);
        return;
      }
    }

    const queueName = `agent:${run.agent_id}`;
    this.getCircuitBreaker(run.agent_id as AgentId)?.recordSuccess();
    if (run.job_id) await this.boss.complete(queueName, run.job_id);
    await updateRunStatus(runId, 'completed', { output: result.output, completedAt: new Date().toISOString() });
    writeAuditLog({ workspaceId: run.workspace_id, agentId: run.agent_id, action: 'complete', entityType: 'agent_run', entityId: runId, details: { outcome: 'completed' } });
  }

  async fail(runId: string, error: FlowError): Promise<void> {
    const run = await getRunById(runId);
    this.getCircuitBreaker(run.agent_id as AgentId)?.recordFailure();

    const isRetryable = 'retryable' in error && error.retryable === true;
    if (isRetryable) {
      writeAuditLog({ workspaceId: run.workspace_id, agentId: run.agent_id, action: 'fail.retryable', entityType: 'agent_run', entityId: runId, details: { error, outcome: 'retry_deferred' } });
      return;
    }

    if (run.job_id) await this.boss.fail(`agent:${run.agent_id}`, run.job_id, error);
    await updateRunStatus(runId, 'failed', { error: { ...error, retryExhausted: false }, completedAt: new Date().toISOString() });
    writeAuditLog({ workspaceId: run.workspace_id, agentId: run.agent_id, action: 'fail', entityType: 'agent_run', entityId: runId, details: { error, retryExhausted: false, outcome: 'failed' } });
  }

  async propose(runId: string, proposal: AgentProposal): Promise<void> {
    await updateRunStatus(runId, 'waiting_approval', { output: proposal as unknown as Record<string, unknown> });
    const run = await getRunById(runId);
    writeAuditLog({ workspaceId: run.workspace_id, agentId: run.agent_id, action: 'propose', entityType: 'agent_run', entityId: runId, details: { outcome: 'waiting_approval' } });
  }
}
