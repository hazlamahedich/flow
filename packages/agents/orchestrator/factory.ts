import { PgBoss } from 'pg-boss';
import type { AgentRunProducer, AgentRunWorker, TrustGateConfig } from './types';
import type { AgentId } from '@flow/types';
import { PgBossProducer } from './pg-boss-producer';
import { PgBossWorker } from './pg-boss-worker';
import { CircuitBreaker } from '../shared/circuit-breaker';
import { writeAuditLog } from '../shared/audit-writer';
import { findStaleRuns, updateRunStatus } from '@flow/db';

export interface OrchestratorHandle {
  producer: AgentRunProducer;
  worker: AgentRunWorker;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

// Connection budget: pg-boss pool (PG_BOSS_MAX_CONNECTIONS) + 1 service client = N+1 connections per worker instance

export function createOrchestrator(trustGateConfig?: TrustGateConfig): OrchestratorHandle {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const maxConnections = Number(process.env.PG_BOSS_MAX_CONNECTIONS) || 10;

  const boss = new PgBoss({
    connectionString,
    schema: 'pgboss',
    supervise: true,
    schedule: false,
    migrate: true,
    max: maxConnections,
    superviseIntervalSeconds: 30,
    monitorIntervalSeconds: 30,
    persistWarnings: true,
    warningRetentionDays: 7,
  });

  const circuitBreakers = new Map<AgentId, CircuitBreaker>();
  const getCircuitBreaker = (agentId: AgentId): CircuitBreaker => {
    let cb = circuitBreakers.get(agentId);
    if (!cb) {
      cb = new CircuitBreaker();
      circuitBreakers.set(agentId, cb);
    }
    return cb;
  };

  const producer = new PgBossProducer(boss);
  const worker = new PgBossWorker(
    boss,
    (agentId) => getCircuitBreaker(agentId),
    trustGateConfig?.trustClient,
    trustGateConfig?.outputSchemaRegistry,
  );

  let recoveryInterval: ReturnType<typeof setInterval> | undefined;
  let started = false;
  let signalHandler: (() => Promise<void>) | undefined;

  const start = async () => {
    if (started) return;
    boss.on('error', (err: unknown) => {
      writeAuditLog({
        workspaceId: '',
        agentId: '',
        action: 'boss.error',
        entityType: 'orchestrator',
        details: { error: String(err) },
      });
    });

    boss.on('warning', (warning: unknown) => {
      writeAuditLog({
        workspaceId: '',
        agentId: '',
        action: 'boss.warning',
        entityType: 'orchestrator',
        details: { warning: String(warning) },
      });
    });

    await boss.start();
    started = true;

    if (trustGateConfig?.outputSchemaRegistry) {
      const mvpIds: AgentId[] = [
        'inbox', 'calendar', 'ar-collection',
        'weekly-report', 'client-health', 'time-integrity',
      ];
      trustGateConfig.outputSchemaRegistry.validateActiveAgents(mvpIds);
    }

    recoveryInterval = setInterval(async () => {
      try {
        await runRecoveryCycle(boss);
      } catch (err: unknown) {
        writeAuditLog({
          workspaceId: '',
          agentId: '',
          action: 'recovery.error',
          entityType: 'orchestrator',
          details: { error: String(err) },
        });
      }
    }, 30_000);

    signalHandler = async () => {
      await stop();
      process.exit(0);
    };
    process.on('SIGTERM', signalHandler);
    process.on('SIGINT', signalHandler);

    writeAuditLog({
      workspaceId: '',
      agentId: '',
      action: 'start',
      entityType: 'orchestrator',
      details: { outcome: 'started' },
    });
  };

  const stop = async () => {
    if (recoveryInterval) clearInterval(recoveryInterval);
    recoveryInterval = undefined;
    if (signalHandler) {
      process.off('SIGTERM', signalHandler);
      process.off('SIGINT', signalHandler);
      signalHandler = undefined;
    }
    started = false;
    await boss.stop({ graceful: true, timeout: 30_000 });

    writeAuditLog({
      workspaceId: '',
      agentId: '',
      action: 'stop',
      entityType: 'orchestrator',
      details: { outcome: 'stopped' },
    });
  };

  return { producer, worker, start, stop };
}

async function runRecoveryCycle(boss: PgBoss): Promise<void> {
  const staleRuns = await findStaleRuns(5);
  for (const run of staleRuns) {
    if (!run.job_id) {
      await updateRunStatus(run.id, 'failed', {
        error: { code: 'AGENT_TIMEOUT', message: 'Recovery: no job_id, orphaned run' },
        completedAt: new Date().toISOString(),
      });
      continue;
    }

    const queueName = `agent:${run.agent_id}`;
    const job = await boss.getJobById(queueName, run.job_id);
    if (job && job.state !== 'failed' && job.state !== 'completed') continue;

    await updateRunStatus(run.id, 'failed', {
      error: {
        code: 'AGENT_TIMEOUT',
        message: 'Recovery: no heartbeat for 5min',
      },
      completedAt: new Date().toISOString(),
    });

    writeAuditLog({
      workspaceId: run.workspace_id,
      agentId: run.agent_id,
      action: 'recovery.timeout',
      entityType: 'agent_run',
      entityId: run.id,
      details: { outcome: 'recovered' },
    });
  }
}
