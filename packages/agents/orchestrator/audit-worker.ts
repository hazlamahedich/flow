import {
  createServiceClient,
  listAllWorkspaces,
  getWeeklyAuditCount,
  insertSignal,
} from '@flow/db';
import type { PgBoss } from 'pg-boss';
import { writeAuditLog } from '../shared/audit-writer';

export async function registerAuditWorkers(boss: PgBoss) {
  await boss.work('weekly-quiet-audit-trigger', async (job) => {
    const supabase = createServiceClient();

    try {
      const workspaces = await listAllWorkspaces(supabase);

      for (const workspace of workspaces) {
        const unreviewedCount = await getWeeklyAuditCount(
          supabase,
          workspace.id,
        );

        if (unreviewedCount >= 5) {
          await insertSignal({
            workspaceId: workspace.id,
            agentId: 'inbox',
            signalType: 'inbox.quiet_audit_due',
            correlationId: crypto.randomUUID(),
            payload: {
              unreviewedCount,
              message: `You have ${unreviewedCount} handled emails from the past 7 days that remain unreviewed.`,
            },
          });

          writeAuditLog({
            workspaceId: workspace.id,
            agentId: 'inbox',
            action: 'quiet_audit.triggered',
            entityType: 'workspace',
            entityId: workspace.id,
            details: { unreviewedCount, outcome: 'signal_emitted' },
          });
        }
      }
    } catch (error) {
      console.error('[audit-worker] Weekly quiet audit failed:', error);
      throw error;
    }
  });
}
