import { createServiceClient } from '@flow/db';
import type { PgBoss } from 'pg-boss';
import type { TrustClient } from '@flow/trust';
import { execute } from '../time-integrity/executor';
import type { SweepDeps } from '../time-integrity/executor';
import { writeAuditLog } from '../shared/audit-writer';
import { PgBossProducer } from './pg-boss-producer';

interface SweepTriggerPayload {
  type: 'sweep_trigger';
  trigger: 'time_integrity_daily' | 'stripe_webhook_cleanup' | 'weekly_report_hourly';
}

interface SweepJobPayload {
  workspaceId: string;
  sweepDate: string;
}

/**
 * Checks if the configured schedule is due based on workspace timezone.
 */
function isScheduleDue(schedule: any, userTimezone: string): boolean {
  const tz = schedule.timezone || userTimezone || 'UTC';
  const now = new Date();
  
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short', // "Mon", "Tue", etc.
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    }).formatToParts(now);
  } catch {
    // Fallback if timezone string is invalid
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23'
    }).formatToParts(now);
  }

  const weekdayPart = parts.find(p => p.type === 'weekday')?.value;
  const hourPart = parts.find(p => p.type === 'hour')?.value;

  const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  const currentDay = dayMap[weekdayPart ?? ''] ?? 0;
  
  const targetDay = schedule.dayOfWeek !== undefined ? Number(schedule.dayOfWeek) : 1; // default Monday
  const targetTime = schedule.time || '06:30';
  const [targetHour] = targetTime.split(':').map(Number);

  const currentHour = Number(hourPart);

  // Checks hourly: if target weekday and target hour matches current hour
  return currentDay === targetDay && currentHour === targetHour;
}

/**
 * Registers sweep trigger handlers (cron → per-workspace enqueue)
 * and fanned-out sweep job handlers.
 */
export async function registerSweepWorkers(boss: PgBoss, trustClient?: TrustClient): Promise<void> {
  // Handler: receives the daily trigger and fans out one job per active workspace
  await boss.work<SweepTriggerPayload>('time-integrity-sweep-trigger', async (_jobs) => {
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

    for (const cfg of configs ?? []) {
      try {
        await boss.send(
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
  await boss.work<SweepJobPayload>('agent:time-integrity:sweep', async (jobs) => {
    const job = jobs[0];
    if (!job) {
      throw new Error('agent:time-integrity:sweep — no job in batch');
    }
    const { workspaceId, sweepDate } = job.data;

    if (!workspaceId) {
      throw new Error('agent:time-integrity:sweep — workspaceId missing in job payload');
    }

    const deps: SweepDeps = { trustClient };
    const result = await execute({ workspaceId, sweepDate }, deps);

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

  // Handler: receives hourly trigger and fans out workspace-level weekly report sweep jobs
  await boss.work<SweepTriggerPayload>('weekly-report-sweep-trigger', async (_jobs) => {
    const client = createServiceClient();

    const { data: configs, error } = await client
      .from('agent_configurations')
      .select('workspace_id, schedule')
      .eq('agent_id', 'weekly-report')
      .eq('status', 'active');

    if (error) {
      writeAuditLog({
        workspaceId: 'system',
        agentId: 'weekly-report',
        action: 'sweep.trigger.fetch_error',
        entityType: 'orchestrator',
        details: { error: error.message },
      });
      throw error;
    }

    let enqueued = 0;

    for (const cfg of configs ?? []) {
      const schedule = (cfg.schedule as any) ?? {};
      
      const { data: member } = await client
        .from('workspace_members')
        .select('user_id, users(timezone)')
        .eq('workspace_id', cfg.workspace_id)
        .eq('role', 'owner')
        .limit(1)
        .maybeSingle();

      const userTimezone = (member?.users as any)?.timezone || 'UTC';

      if (isScheduleDue(schedule, userTimezone)) {
        try {
          await boss.send(
            'agent:weekly-report:workspace-sweep',
            { workspaceId: cfg.workspace_id as string },
            { retryLimit: 2, retryDelay: 60 }
          );
          enqueued++;
        } catch (sendErr: unknown) {
          writeAuditLog({
            workspaceId: cfg.workspace_id as string,
            agentId: 'weekly-report',
            action: 'sweep.trigger.enqueue_error',
            entityType: 'workspace',
            entityId: cfg.workspace_id as string,
            details: { error: String(sendErr) },
          });
        }
      }
    }

    writeAuditLog({
      workspaceId: 'system',
      agentId: 'weekly-report',
      action: 'sweep.trigger.enqueued',
      entityType: 'orchestrator',
      details: { workspacesEnqueued: enqueued, workspacesTotal: (configs ?? []).length },
    });
  });

  // Handler: workspace-level sweep that fans out jobs for each active client
  await boss.work<{ workspaceId: string }>('agent:weekly-report:workspace-sweep', async (jobs) => {
    const job = jobs[0];
    if (!job) {
      throw new Error('agent:weekly-report:workspace-sweep — no job in batch');
    }
    const { workspaceId } = job.data;
    if (!workspaceId) {
      throw new Error('agent:weekly-report:workspace-sweep — workspaceId missing in payload');
    }

    const client = createServiceClient();

    const { data: activeClients, error } = await client
      .from('clients')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active');

    if (error) {
      writeAuditLog({
        workspaceId,
        agentId: 'weekly-report',
        action: 'sweep.workspace.fetch_clients_error',
        entityType: 'workspace',
        entityId: workspaceId,
        details: { error: error.message },
      });
      throw error;
    }

    const { data: member } = await client
      .from('workspace_members')
      .select('users!inner(timezone)')
      .eq('workspace_id', workspaceId)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();

    const tz = (member?.users as any)?.timezone || 'UTC';
    
    // Get current date string in target timezone "YYYY-MM-DD"
    const tzDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const [yyyy, mm, dd] = tzDateStr.split('-');
    const localNow = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0);

    const currentDay = localNow.getDay();
    const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
    
    const lastMonday = new Date(localNow.getTime() - (daysSinceMonday + 7) * 24 * 60 * 60 * 1000);
    const lastSunday = new Date(localNow.getTime() - (daysSinceMonday + 1) * 24 * 60 * 60 * 1000);
    
    const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const periodStart = formatDate(lastMonday);
    const periodEnd = formatDate(lastSunday);

    const producer = new PgBossProducer(boss);
    let fannedOut = 0;

    for (const c of activeClients ?? []) {
      try {
        const runId = crypto.randomUUID();
        await producer.submit({
          agentId: 'weekly-report',
          actionType: 'weekly_report_draft',
          clientId: c.id,
          correlationId: runId,
          input: {
            workspaceId,
            clientId: c.id,
            periodStart,
            periodEnd,
            agentRunId: runId,
            trigger: 'cron',
          },
          idempotencyKey: `weekly-report:${c.id}:${periodStart}:${periodEnd}`,
        });
        fannedOut++;
      } catch (sendErr: unknown) {
        writeAuditLog({
          workspaceId,
          agentId: 'weekly-report',
          action: 'sweep.workspace.enqueue_client_error',
          entityType: 'client',
          entityId: c.id,
          details: { error: String(sendErr), periodStart, periodEnd },
        });
      }
    }

    writeAuditLog({
      workspaceId,
      agentId: 'weekly-report',
      action: 'sweep.workspace.success',
      entityType: 'workspace',
      entityId: workspaceId,
      details: { clientsFannedOut: fannedOut, clientsTotal: (activeClients ?? []).length, periodStart, periodEnd },
    });
  });
}
