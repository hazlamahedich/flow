'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import { generateWeeklyReportSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import { PgBoss } from 'pg-boss';
import { PgBossProducer } from '@flow/agents/orchestrator/pg-boss-producer';

interface SubmitRunResult {
  runId: string;
  status: string;
}

export async function submitWeeklyReportRunAction(
  input: unknown,
): Promise<ActionResult<SubmitRunResult>> {
  const parsed = generateWeeklyReportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  let ctx;
  try {
    ctx = await requireTenantContext(supabase);
  } catch {
    return {
      success: false,
      error: createFlowError(401, 'AUTH_REQUIRED', 'Authentication required', 'auth'),
    };
  }

  if (!['owner', 'admin'].includes(ctx.role)) {
    return {
      success: false,
      error: createFlowError(403, 'FORBIDDEN', 'Only workspace owners and admins can trigger agent runs.', 'auth'),
    };
  }

  const { clientId, periodStart, periodEnd } = parsed.data;

  // Check if client exists and belongs to the workspace
  const { data: clientRow, error: clientErr } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (clientErr || !clientRow) {
    return {
      success: false,
      error: createFlowError(404, 'CLIENT_NOT_FOUND', 'Client not found in workspace.', 'validation'),
    };
  }

  const runId = crypto.randomUUID();

  // Enqueue via pg-boss
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'DATABASE_URL is not set', 'system'),
    };
  }

  try {
    const boss = new PgBoss({
      connectionString,
      schema: 'pgboss',
    });
    await boss.start();
    const producer = new PgBossProducer(boss);

    const handle = await producer.submit({
      agentId: 'weekly-report',
      actionType: 'weekly_report_draft',
      clientId,
      correlationId: runId,
      input: {
        workspace_id: ctx.workspaceId,
        clientId,
        periodStart,
        periodEnd,
        agentRunId: runId,
        trigger: 'manual',
      },
      idempotencyKey: `weekly-report:${clientId}:${periodStart}:${periodEnd}`,
    });

    await boss.stop();

    return {
      success: true,
      data: {
        runId: handle.runId,
        status: handle.status,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', `Failed to enqueue agent run: ${err.message}`, 'system'),
    };
  }
}
