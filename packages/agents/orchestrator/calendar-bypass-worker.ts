import { createServiceClient, updateRunStatus } from '@flow/db';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import { executeDetectBypass } from '../calendar/detect-bypass-action.js';
import { executeResolveCascade } from '../calendar/resolve-cascade-action.js';
import { emitDailyPreviewSignal } from '../calendar/daily-preview.js';
import { writeAuditLog } from '../shared/audit-writer';
import type { DetectBypassInput } from '../calendar/detect-bypass-action.js';
import type { ResolveCascadeInput } from '../calendar/resolve-cascade-action.js';


const DetectBypassJobInputSchema = z.object({
  eventId: z.string().uuid(),
  clientId: z.string().uuid(),
  eventCreatedAt: z.string(),
  workspace_id: z.string().uuid(),
});

const ResolveCascadeJobInputSchema = z.object({
  originEventId: z.string().uuid(),
  clientId: z.string().uuid().nullable().optional(),
  action: z.enum(['cancelled', 'rescheduled']),
  newStartAt: z.string().nullable().optional(),
  newEndAt: z.string().nullable().optional(),
  workspace_id: z.string().uuid(),
});

export { DetectBypassJobInputSchema, ResolveCascadeJobInputSchema };

export async function handleDetectBypass(
  runId: string, workspaceId: string, input: Record<string, unknown>, supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const inputParsed = DetectBypassJobInputSchema.safeParse(input);
  if (!inputParsed.success) {
    writeAuditLog({ workspaceId, agentId: 'calendar', action: 'worker.invalid_input',
      entityType: 'agent_run', entityId: runId,
      details: { error: inputParsed.error.message, outcome: 'skipped' } });
    return;
  }

  const bypassInput: DetectBypassInput = {
    workspaceId,
    eventId: inputParsed.data.eventId,
    clientId: inputParsed.data.clientId,
    eventCreatedAt: inputParsed.data.eventCreatedAt,
  };

  try { await updateRunStatus(runId, 'running', { startedAt: new Date().toISOString() }); }
  catch { /* non-fatal */ }

  try {
    const result = await executeDetectBypass(runId, bypassInput, { supabase });
    try { await updateRunStatus(runId, 'completed', {
      completedAt: new Date().toISOString(),
      output: { isBypass: result.isBypass, bypassRate: result.bypassRate, signalEmitted: result.signalEmitted } as unknown as Record<string, unknown>,
    }); } catch { /* non-fatal */ }

    writeAuditLog({ workspaceId, agentId: 'calendar', action: 'detectBypass.complete',
      entityType: 'agent_run', entityId: runId,
      details: { isBypass: result.isBypass, bypassRate: result.bypassRate, outcome: 'completed' } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bypass detection failed';
    try { await updateRunStatus(runId, 'failed', {
      completedAt: new Date().toISOString(),
      error: { message } as unknown as Record<string, unknown>,
    }); } catch { /* non-fatal */ }

    writeAuditLog({ workspaceId, agentId: 'calendar', action: 'detectBypass.error',
      entityType: 'agent_run', entityId: runId,
      details: { error: message, outcome: 'failed' } });
    throw err;
  }
}

export async function handleResolveCascade(
  runId: string, workspaceId: string, input: Record<string, unknown>, supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const inputParsed = ResolveCascadeJobInputSchema.safeParse(input);
  if (!inputParsed.success) {
    writeAuditLog({ workspaceId, agentId: 'calendar', action: 'worker.invalid_input',
      entityType: 'agent_run', entityId: runId,
      details: { error: inputParsed.error.message, outcome: 'skipped' } });
    return;
  }

  const cascadeInput: ResolveCascadeInput = {
    workspaceId,
    originEventId: inputParsed.data.originEventId,
    clientId: inputParsed.data.clientId ?? null,
    action: inputParsed.data.action,
    newStartAt: inputParsed.data.newStartAt ?? null,
    newEndAt: inputParsed.data.newEndAt ?? null,
  };

  try { await updateRunStatus(runId, 'running', { startedAt: new Date().toISOString() }); }
  catch { /* non-fatal */ }

  try {
    const result = await executeResolveCascade(runId, cascadeInput, {
      supabase,
    });
    try { await updateRunStatus(runId, 'completed', {
      completedAt: new Date().toISOString(),
      output: { affectedCount: result.affectedCount, optionCount: result.options.length } as unknown as Record<string, unknown>,
    }); } catch { /* non-fatal */ }

    writeAuditLog({ workspaceId, agentId: 'calendar', action: 'resolveCascade.complete',
      entityType: 'agent_run', entityId: runId,
      details: { affectedCount: result.affectedCount, optionCount: result.options.length, outcome: 'completed' } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cascade resolution failed';
    try { await updateRunStatus(runId, 'failed', {
      completedAt: new Date().toISOString(),
      error: { message } as unknown as Record<string, unknown>,
    }); } catch { /* non-fatal */ }

    writeAuditLog({ workspaceId, agentId: 'calendar', action: 'resolveCascade.error',
      entityType: 'agent_run', entityId: runId,
      details: { error: message, outcome: 'failed' } });
    throw err;
  }
}

export async function registerCalendarScheduledJobs(boss: PgBoss): Promise<void> {
  await boss.schedule('agent:calendar:dailyPreview', '0 6:45 * * *', {
    actionType: 'dailyPreview',
  });

  await boss.work('agent:calendar:dailyPreview', async () => {
    const supabase = createServiceClient();

    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .eq('status', 'active');

    for (const ws of (workspaces ?? []) as Array<{ id: string }>) {
      const workspaceId = ws.id;
      try {
        await emitDailyPreviewSignal(workspaceId, { supabase });
        writeAuditLog({ workspaceId, agentId: 'calendar', action: 'dailyPreview.complete',
          entityType: 'agent_run', entityId: 'scheduled',
          details: { outcome: 'completed' } });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Daily preview failed';
        writeAuditLog({ workspaceId, agentId: 'calendar', action: 'dailyPreview.error',
          entityType: 'agent_run', entityId: 'scheduled',
          details: { error: message, outcome: 'failed' } });
      }
    }
  });
}
