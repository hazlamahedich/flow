import type { PgBoss } from 'pg-boss';
import { writeAuditLog } from '../shared/audit-writer';

interface ScheduleEntry {
  name: string;
  cron: string;
  data: Record<string, unknown>;
}

const SCHEDULES: ScheduleEntry[] = [
  {
    name: 'weekly-quiet-audit-trigger',
    cron: '0 9 * * 5', // 9:00 AM Friday UTC
    data: { type: 'scheduled_trigger', trigger: 'weekly_quiet_audit' },
  },
  {
    // Story 5.4 — AC2: daily integrity sweep at 2am UTC (low-traffic window)
    name: 'time-integrity-sweep-trigger',
    cron: '0 2 * * *',
    data: { type: 'sweep_trigger', trigger: 'time_integrity_daily' },
  },
  {
    // Story 8-2: hourly check to trigger workspace-level weekly report sweeps
    name: 'weekly-report-sweep-trigger',
    cron: '0 * * * *',
    data: { type: 'sweep_trigger', trigger: 'weekly_report_hourly' },
  },
  {
    // Story 8-3: hourly check to trigger workspace-level client health sweeps
    name: 'client-health-sweep-trigger',
    cron: '0 * * * *',
    data: { type: 'sweep_trigger', trigger: 'client_health_hourly' },
  },
  {
    // Story 7.5 — AC2: daily cleanup of expired stripe_webhook_events at 3am UTC
    name: 'cleanup-expired-stripe-events',
    cron: '0 3 * * *',
    data: { type: 'sweep_trigger', trigger: 'stripe_webhook_cleanup' },
  },
  {
    // Story 8-4: Friday 4:00 PM EST (21:00 UTC) — Friday Feeling sweep
    name: 'friday-feeling-sweep-trigger',
    cron: '0 21 * * 5',
    data: { type: 'sweep_trigger', trigger: 'friday_feeling_friday' },
  },
  {
    // Story 8-4: Wednesday 9:00 AM EST (14:00 UTC) — Wednesday affirmation sweep
    name: 'wednesday-affirmation-sweep-trigger',
    cron: '0 14 * * 3',
    data: { type: 'sweep_trigger', trigger: 'wednesday_affirmation' },
  },
  // Story 9-5a — FR59 lifecycle: daily grace + suspension sweeps at 02:00 UTC
  // (low-traffic window, mirrors `time-integrity-sweep-trigger`).
  {
    name: 'subscription-grace-sweep-trigger',
    cron: '0 2 * * *',
    data: { type: 'sweep_trigger', trigger: 'subscription_grace_daily' },
  },
  {
    name: 'subscription-suspension-sweep-trigger',
    cron: '0 2 * * *',
    data: { type: 'sweep_trigger', trigger: 'subscription_suspension_daily' },
  },
  // Story 9-5a — NFR54: nightly reconciliation at 03:00 UTC (after the two sweeps).
  {
    name: 'subscription-reconcile-trigger',
    cron: '0 3 * * *',
    data: { type: 'sweep_trigger', trigger: 'subscription_reconcile_nightly' },
  },
];

export async function registerSchedules(boss: PgBoss): Promise<void> {
  // P10: collect failures so all schedules are attempted before throwing
  const failed: string[] = [];

  for (const schedule of SCHEDULES) {
    try {
      await boss.schedule(schedule.name, schedule.cron, schedule.data);
      writeAuditLog({
        workspaceId: 'system',
        agentId: 'orchestrator',
        action: 'schedule.registered',
        entityType: 'scheduler',
        details: {
          scheduleName: schedule.name,
          cron: schedule.cron,
          outcome: 'success',
        },
      });
    } catch (error) {
      console.error(
        `[scheduler] Failed to register schedule ${schedule.name}:`,
        error,
      );
      failed.push(schedule.name);
    }
  }

  if (failed.length > 0) {
    throw new Error(
      `[scheduler] Failed to register schedule(s): ${failed.join(', ')}`,
    );
  }
}
