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
    cron: '0 9 * * 5',  // 9:00 AM Friday UTC
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
    // Story 7.5 — AC2: daily cleanup of expired stripe_webhook_events at 3am UTC
    name: 'cleanup-expired-stripe-events',
    cron: '0 3 * * *',
    data: { type: 'sweep_trigger', trigger: 'stripe_webhook_cleanup' },
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
        details: { scheduleName: schedule.name, cron: schedule.cron, outcome: 'success' },
      });
    } catch (error) {
      console.error(`[scheduler] Failed to register schedule ${schedule.name}:`, error);
      failed.push(schedule.name);
    }
  }

  if (failed.length > 0) {
    throw new Error(`[scheduler] Failed to register schedule(s): ${failed.join(', ')}`);
  }
}
