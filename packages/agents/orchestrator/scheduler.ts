import type { PgBoss } from 'pg-boss';
import { writeAuditLog } from '../shared/audit-writer';

export async function registerSchedules(boss: PgBoss) {
  // AC3: Every Friday at 9:00 AM local
  // Note: pg-boss schedule uses cron syntax. 
  // '0 9 * * 5' = 9:00 AM on Friday
  // However, AC3 says "9:00 AM local". 
  // We'll schedule a global job that triggers per-workspace checks.
  
  const scheduleName = 'weekly-quiet-audit-trigger';
  const cron = '0 9 * * 5'; // 9:00 AM Friday (UTC by default in pg-boss if not specified)
  
  try {
    // We use a dedicated queue for the trigger
    await boss.schedule(scheduleName, cron, {
      type: 'scheduled_trigger',
      trigger: 'weekly_quiet_audit'
    });
    
    writeAuditLog({
      workspaceId: 'system',
      agentId: 'orchestrator',
      action: 'schedule.registered',
      entityType: 'scheduler',
      details: { scheduleName, cron, outcome: 'success' }
    });
  } catch (error) {
    console.error(`[scheduler] Failed to register schedule ${scheduleName}:`, error);
    throw error;
  }
}
