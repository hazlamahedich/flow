import type { PgBoss } from 'pg-boss';
import type { AgentRunProducer } from './types';
import type { AgentRunHandle, AgentRunRequest, AgentRunStatus, AgentRunSummary, RunListFilter } from '@flow/types';
import { AgentJobPayloadSchema } from './schemas';
import { OrchestratorError } from './errors';
import {
  insertRun,
  findByIdempotencyKey,
  updateRunStatus,
  getRunsByWorkspace,
  getRunById,
} from '@flow/db';
import { writeAuditLog } from '../shared/audit-writer';

const JOB_OPTIONS = {
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  expireInSeconds: 300,
  heartbeatSeconds: 60,
  deleteAfterSeconds: 86400,
} as const;

const TERMINAL_STATUSES: AgentRunStatus[] = ['completed', 'failed', 'cancelled', 'timed_out'];

export class PgBossProducer implements AgentRunProducer {
  constructor(private readonly boss: PgBoss) {}

  async submit(request: AgentRunRequest): Promise<AgentRunHandle> {
    const {
      agentId, actionType, input, clientId,
      idempotencyKey, correlationId, signalId,
    } = request;
    const workspaceId = input.workspace_id;
    if (!workspaceId || typeof workspaceId !== 'string') {
      throw new OrchestratorError('INVALID_INPUT', 'input.workspace_id is required');
    }
    const correlation = correlationId ?? crypto.randomUUID();

    if (idempotencyKey && workspaceId) {
      const existing = await findByIdempotencyKey(idempotencyKey, workspaceId);
      if (existing) {
        writeAuditLog({
          workspaceId: existing.workspace_id,
          agentId: existing.agent_id,
          action: 'submit.dedup',
          entityType: 'agent_run',
          entityId: existing.id,
          details: { idempotencyKey, outcome: 'existing' },
        });
        return { runId: existing.id, status: existing.status };
      }
    }

    const runId = crypto.randomUUID();

    const payload = AgentJobPayloadSchema.parse({
      runId,
      workspaceId,
      agentId,
      actionType,
      input,
      clientId: clientId ?? null,
      correlationId: correlation,
    });

    const queueName = `agent:${agentId}`;
    const bossJobId = await this.boss.send(queueName, payload, JOB_OPTIONS);
    if (!bossJobId) {
      throw new OrchestratorError('JOB_REJECTED', `pg-boss rejected job for ${queueName}`);
    }

    try {
      await insertRun({
        id: runId,
        workspaceId,
        agentId,
        jobId: bossJobId,
        signalId: signalId ?? null,
        actionType,
        clientId: clientId ?? null,
        idempotencyKey: idempotencyKey ?? null,
        status: 'queued',
        input,
        correlationId: correlation,
      });
    } catch (err: unknown) {
      if (idempotencyKey && isUniqueViolation(err)) {
        const existing = await findByIdempotencyKey(idempotencyKey, workspaceId);
        if (existing) {
          try { await this.boss.cancel(queueName, bossJobId); } catch { /* best-effort cleanup */ }
          writeAuditLog({
            workspaceId: existing.workspace_id,
            agentId: existing.agent_id,
            action: 'submit.dedup_toctou',
            entityType: 'agent_run',
            entityId: existing.id,
            details: { idempotencyKey, outcome: 'constraint_catch' },
          });
          return { runId: existing.id, status: existing.status };
        }
      }
      throw err;
    }

    writeAuditLog({
      workspaceId,
      agentId,
      action: 'submit',
      entityType: 'agent_run',
      entityId: runId,
      details: { jobId: bossJobId, actionType, correlationId: correlation, outcome: 'created' },
    });

    return { runId, status: 'queued' };
  }

  async cancel(runId: string, reason: string): Promise<void> {
    const run = await getRunById(runId);
    if (TERMINAL_STATUSES.includes(run.status as AgentRunStatus)) return;
    if (!run.job_id) return;

    try {
      await this.boss.cancel(`agent:${run.agent_id}`, run.job_id);
    } catch {
      // pg-boss cancel may fail if job already completed/expired — best-effort
    }
    await updateRunStatus(runId, 'cancelled', {
      error: { reason },
      completedAt: new Date().toISOString(),
    });

    writeAuditLog({
      workspaceId: run.workspace_id,
      agentId: run.agent_id,
      action: 'cancel',
      entityType: 'agent_run',
      entityId: runId,
      details: { reason },
    });
  }

  async getStatus(runId: string): Promise<AgentRunStatus> {
    const run = await getRunById(runId);
    return run.status as AgentRunStatus;
  }

  async listRuns(filter: RunListFilter): Promise<AgentRunSummary[]> {
    const workspaceId = (filter as Record<string, unknown>).workspaceId;
    if (!workspaceId || typeof workspaceId !== 'string') return [];
    const dbFilter: { agentId?: string; status?: string; limit?: number; offset?: number } = {};
    if (filter.agentId) dbFilter.agentId = filter.agentId;
    if (filter.status) dbFilter.status = filter.status;
    if (filter.limit) dbFilter.limit = filter.limit;
    if (filter.offset) dbFilter.offset = filter.offset;
    const runs = await getRunsByWorkspace(workspaceId, dbFilter);
    return runs.map((r) => ({
      id: r.id,
      agentId: r.agent_id,
      actionType: r.action_type,
      status: r.status as AgentRunStatus,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code: string }).code === '23505';
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return (err as { message: string }).message.includes('duplicate key') ||
      (err as { message: string }).message.includes('unique') ||
      (err as { message: string }).message.includes('23505');
  }
  return false;
}
