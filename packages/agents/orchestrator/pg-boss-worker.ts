import type { PgBoss, Job } from 'pg-boss';
import type { AgentRunWorker } from './types';
import type { AgentId, AgentRunHandle, AgentRunResult, AgentProposal, FlowError } from '@flow/types';
import { AgentJobPayloadSchema } from './schemas';
import { claimRunWithGuard, updateRunStatus, releaseRun, getRunById } from '@flow/db';
import { writeAuditLog } from '../shared/audit-writer';
import { CircuitBreaker } from '../shared/circuit-breaker';

export class PgBossWorker implements AgentRunWorker {
  constructor(
    private readonly boss: PgBoss,
    private readonly getCircuitBreaker: (agentId: AgentId) => CircuitBreaker | undefined,
  ) {}

  async claim(agentType: AgentId): Promise<AgentRunHandle | null> {
    const queueName = `agent:${agentType}`;
    const jobs = await this.boss.fetch(queueName);
    if (!jobs || jobs.length === 0) return null;

    const job = jobs[0] as Job<unknown>;
    const payload = AgentJobPayloadSchema.parse(job.data);

    const cb = this.getCircuitBreaker(agentType);
    if (cb && !cb.allowRequest()) {
      writeAuditLog({
        workspaceId: payload.workspaceId,
        agentId: payload.agentId,
        action: 'claim.circuit_open',
        entityType: 'agent_run',
        entityId: payload.runId,
        details: { jobId: job.id, outcome: 'released' },
      });
      return null;
    }

    const updated = await claimRunWithGuard(payload.runId, job.id, {
      startedAt: new Date().toISOString(),
    });
    if (!updated) {
      writeAuditLog({
        workspaceId: payload.workspaceId,
        agentId: payload.agentId,
        action: 'claim.guard_reject',
        entityType: 'agent_run',
        entityId: payload.runId,
        details: { jobId: job.id, outcome: 'released' },
      });
      return null;
    }

    writeAuditLog({
      workspaceId: payload.workspaceId,
      agentId: payload.agentId,
      action: 'claim',
      entityType: 'agent_run',
      entityId: payload.runId,
      details: { jobId: job.id, outcome: 'claimed' },
    });

    return { runId: payload.runId, status: 'running' };
  }

  async complete(runId: string, result: AgentRunResult): Promise<void> {
    const run = await getRunById(runId);
    const queueName = `agent:${run.agent_id}`;
    const cb = this.getCircuitBreaker(run.agent_id as AgentId);
    cb?.recordSuccess();

    if (run.job_id) {
      await this.boss.complete(queueName, run.job_id);
    }
    await updateRunStatus(runId, 'completed', {
      output: result.output,
      completedAt: new Date().toISOString(),
    });

    writeAuditLog({
      workspaceId: run.workspace_id,
      agentId: run.agent_id,
      action: 'complete',
      entityType: 'agent_run',
      entityId: runId,
      details: { outcome: 'completed' },
    });
  }

  async fail(runId: string, error: FlowError): Promise<void> {
    const run = await getRunById(runId);
    const queueName = `agent:${run.agent_id}`;
    const cb = this.getCircuitBreaker(run.agent_id as AgentId);
    cb?.recordFailure();

    const isRetryable = 'retryable' in error && error.retryable === true;
    if (isRetryable) {
      writeAuditLog({
        workspaceId: run.workspace_id,
        agentId: run.agent_id,
        action: 'fail.retryable',
        entityType: 'agent_run',
        entityId: runId,
        details: { error, outcome: 'retry_deferred' },
      });
      return;
    }

    if (run.job_id) {
      await this.boss.fail(queueName, run.job_id, error);
    }
    await updateRunStatus(runId, 'failed', {
      error: { ...error, retryExhausted: false },
      completedAt: new Date().toISOString(),
    });

    writeAuditLog({
      workspaceId: run.workspace_id,
      agentId: run.agent_id,
      action: 'fail',
      entityType: 'agent_run',
      entityId: runId,
      details: { error, retryExhausted: false, outcome: 'failed' },
    });
  }

  async propose(runId: string, proposal: AgentProposal): Promise<void> {
    const run = await getRunById(runId);
    await updateRunStatus(runId, 'waiting_approval', {
      output: proposal as unknown as Record<string, unknown>,
    });

    writeAuditLog({
      workspaceId: run.workspace_id,
      agentId: run.agent_id,
      action: 'propose',
      entityType: 'agent_run',
      entityId: runId,
      details: { outcome: 'waiting_approval' },
    });
  }
}
