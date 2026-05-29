import { createServiceClient, updateRunStatus } from '@flow/db';
import type { PgBoss } from 'pg-boss';
import type { TrustClient } from '@flow/trust';
import { z } from 'zod';
import { execute as executeWeeklyReport } from '../weekly-report/executor';
import { writeAuditLog } from '../shared/audit-writer';
import { AgentJobPayloadSchema } from './schemas.js';

const QUEUE_NAME = 'agent:weekly-report';

const WeeklyReportJobInputSchema = z.object({
  workspaceId: z.string().uuid(),
  clientId: z.string().uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  agentRunId: z.string().uuid(),
  trigger: z.enum(['cron', 'manual']).default('cron'),
});

export async function registerWeeklyReportWorkers(boss: PgBoss, trustClient?: TrustClient): Promise<void> {
  await boss.work(QUEUE_NAME, async (jobs) => {
    const job = Array.isArray(jobs) ? jobs[0] : jobs;
    if (!job) return;
    
    const parsed = AgentJobPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      writeAuditLog({
        workspaceId: 'unknown',
        agentId: 'weekly-report',
        action: 'worker.invalid_payload',
        entityType: 'agent_run',
        entityId: 'unknown',
        details: { error: parsed.error.message, outcome: 'skipped' }
      });
      return;
    }

    const { runId, workspaceId, actionType, input } = parsed.data;

    if (actionType === 'weekly_report_draft') {
      const inputParsed = WeeklyReportJobInputSchema.safeParse(input);
      if (!inputParsed.success) {
        writeAuditLog({
          workspaceId,
          agentId: 'weekly-report',
          action: 'worker.invalid_input',
          entityType: 'agent_run',
          entityId: runId,
          details: { error: inputParsed.error.message, outcome: 'skipped' }
        });
        return;
      }

      try {
        await updateRunStatus(runId, 'running', { startedAt: new Date().toISOString() });
      } catch { /* non-fatal */ }

      try {
        const proposal = await executeWeeklyReport({
          workspaceId,
          clientId: inputParsed.data.clientId,
          periodStart: inputParsed.data.periodStart,
          periodEnd: inputParsed.data.periodEnd,
          agentRunId: runId,
          trigger: inputParsed.data.trigger,
        });

        const supabase = createServiceClient();
        const { data: agentConfig } = await supabase
          .from('agent_configurations')
          .select('status')
          .eq('workspace_id', workspaceId)
          .eq('agent_id', 'weekly-report')
          .single();

        if (agentConfig?.status === 'paused') {
          await updateRunStatus(runId, 'cancelled', {
            completedAt: new Date().toISOString(),
            error: { code: 'AGENT_PAUSED', message: 'Weekly report agent is paused' },
          });
          writeAuditLog({
            workspaceId,
            agentId: 'weekly-report',
            action: 'weekly_report_draft.paused',
            entityType: 'agent_run',
            entityId: runId,
            details: { outcome: 'cancelled' }
          });
          return;
        }

        const evalResult = trustClient
          ? await trustClient.canAct('weekly-report', 'weekly_report_draft', workspaceId, runId, {})
          : { allowed: false, level: 'supervised', reason: 'no trust client' };

        const trustLevel = evalResult.level;
        const isAutoApprove = trustLevel === 'auto';

        if (isAutoApprove) {
          await updateRunStatus(runId, 'completed', {
            completedAt: new Date().toISOString(),
            output: proposal as unknown as Record<string, unknown>,
          });
          writeAuditLog({
            workspaceId,
            agentId: 'weekly-report',
            action: 'weekly_report_draft.complete',
            entityType: 'agent_run',
            entityId: runId,
            details: { outcome: 'completed', trustLevel }
          });
        } else {
          // Gated approval required
          const proposalId = crypto.randomUUID();
          await supabase.from('agent_proposals').insert({
            id: proposalId,
            agent_run_id: runId,
            workspace_id: workspaceId,
            client_id: inputParsed.data.clientId,
            status: 'pending',
            proposal_data: proposal as unknown as Record<string, unknown>
          });

          await updateRunStatus(runId, 'waiting_approval', {
            output: { proposalId, ...(proposal as unknown as Record<string, unknown>) },
          });
          writeAuditLog({
            workspaceId,
            agentId: 'weekly-report',
            action: 'weekly_report_draft.propose',
            entityType: 'agent_run',
            entityId: runId,
            details: { outcome: 'waiting_approval', trustLevel }
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Draft compilation failed';
        const isPostCheckViolation = message.includes('POST_CHECK_VIOLATION');
        const isHallucination = message.includes('HALLUCINATION_DETECTED');
        const isBudgetExceeded = message.includes('LLM Budget exceeded');

        let code = 'AGENT_FAILED';
        if (isPostCheckViolation) code = 'POST_CHECK_VIOLATION';
        else if (isHallucination) code = 'HALLUCINATION_DETECTED';
        else if (isBudgetExceeded) code = 'BUDGET_EXCEEDED';

        try {
          await updateRunStatus(runId, 'failed', {
            completedAt: new Date().toISOString(),
            error: { code, message },
          });
        } catch { /* log and ignore db error to prevent crash */ }

        writeAuditLog({
          workspaceId,
          agentId: 'weekly-report',
          action: 'weekly_report_draft.error',
          entityType: 'agent_run',
          entityId: runId,
          details: { error: message, code, outcome: 'failed' }
        });
      }
    }
  });
}
