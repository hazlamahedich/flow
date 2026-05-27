import { createServiceClient } from '@flow/db';
import type { PgBoss } from 'pg-boss';
import type { TrustClient } from '@flow/trust';
import { execute } from '../time-integrity/executor';
import { writeAuditLog } from '../shared/audit-writer';

interface SweepTriggerPayload {
  type: 'sweep_trigger';
  trigger: 'time_integrity_daily' | 'stripe_webhook_cleanup';
}

interface SweepJobPayload {
  workspaceId: string;
  sweepDate: string;
}

/**
 * Registers both the sweep trigger handler (cron → per-workspace enqueue)
 * and the sweep job handler (per-workspace execution).
 */
export async function registerSweepWorkers(boss: PgBoss, trustClient?: TrustClient): Promise<void> {
  // Handler: receives the daily trigger and fans out one job per active workspace
  await boss.work<SweepTriggerPayload>('time-integrity-sweep-trigger', async (_job) => {
    const client = createServiceClient();

    const { data: configs, error } = await client
      .from('agent_configurations')
      .select('workspace_id')
      .eq('agent_id', 'time-integrity')
      .eq('status', 'active');

    if (error) {
      writeAuditLog({
        workspaceId: 'system',
        agentId: 'time-integrity',
        action: 'sweep.trigger.fetch_error',
        entityType: 'orchestrator',
        details: { error: error.message },
      });
      throw error;
    }

    const today = new Date().toISOString().slice(0, 10);
    let enqueued = 0;

    // P5: isolate per-workspace enqueue failures so one bad workspace cannot abort all others
    for (const cfg of configs ?? []) {
      try {
        await boss.send<SweepJobPayload>(
          'agent:time-integrity:sweep',
          { workspaceId: cfg.workspace_id as string, sweepDate: today },
          { retryLimit: 2, retryDelay: 60 },
        );
        enqueued++;
      } catch (sendErr: unknown) {
        writeAuditLog({
          workspaceId: cfg.workspace_id as string,
          agentId: 'time-integrity',
          action: 'sweep.trigger.enqueue_error',
          entityType: 'workspace',
          entityId: cfg.workspace_id as string,
          details: { error: String(sendErr), sweepDate: today },
        });
      }
    }

    writeAuditLog({
      workspaceId: 'system',
      agentId: 'time-integrity',
      action: 'sweep.trigger.enqueued',
      entityType: 'orchestrator',
      details: { workspacesEnqueued: enqueued, workspacesTotal: (configs ?? []).length, sweepDate: today },
    });
  });

  // Handler: cleanup expired stripe webhook events (daily at 03:00 UTC)
  await boss.work<SweepTriggerPayload>('cleanup-expired-stripe-events', async (_job) => {
    const client = createServiceClient();
    const { data, error } = await client.rpc('cleanup_expired_stripe_webhook_events');

    if (error) {
      writeAuditLog({
        workspaceId: 'system',
        agentId: 'stripe-webhook',
        action: 'cleanup.error',
        entityType: 'orchestrator',
        details: { error: error.message },
      });
      throw error;
    }

    writeAuditLog({
      workspaceId: 'system',
      agentId: 'stripe-webhook',
      action: 'cleanup.success',
      entityType: 'orchestrator',
      details: { deletedCount: data },
    });
  });

  // Handler: processes the sweep for a single workspace
  await boss.work<SweepJobPayload>('agent:time-integrity:sweep', async (job) => {
    const { workspaceId, sweepDate } = job.data;

    if (!workspaceId) {
      throw new Error('agent:time-integrity:sweep — workspaceId missing in job payload');
    }

    const result = await execute({ workspaceId, sweepDate }, { trustClient });

    if (!result.success) {
      writeAuditLog({
        workspaceId,
        agentId: 'time-integrity',
        action: 'sweep.job.failed',
        entityType: 'workspace',
        entityId: workspaceId,
        details: { error: result.error, sweepDate },
      });
      throw new Error(`Sweep failed for workspace ${workspaceId}: ${result.error.message}`);
    }

    writeAuditLog({
      workspaceId,
      agentId: 'time-integrity',
      action: 'sweep.job.success',
      entityType: 'workspace',
      entityId: workspaceId,
      details: { ...result.data, sweepDate },
    });
  });
}
