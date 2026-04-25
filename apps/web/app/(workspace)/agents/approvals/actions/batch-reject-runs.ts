'use server';

import { batchActionSchema } from './schemas';
import type { ActionResult, BatchActionResult } from '@flow/types';
import { createFlowError, requireTenantContext } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';

export async function batchRejectRuns(
  input: unknown,
): Promise<ActionResult<BatchActionResult>> {
  const parsed = batchActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 'validation'),
    };
  }

  const { runIds } = parsed.data;
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const succeeded: BatchActionResult['succeeded'] = [];
  const failed: BatchActionResult['failed'] = [];

  for (const runId of runIds) {
    const { data: run, error: selectError } = await supabase
      .from('agent_runs')
      .select('id, status, output')
      .eq('id', runId)
      .eq('workspace_id', ctx.workspaceId)
      .single();

    if (selectError || !run) {
      failed.push({ runId, error: 'Run not found' });
      continue;
    }

    if (run.status === 'cancelled' || run.status === 'completed') {
      succeeded.push({ runId, newStatus: run.status as import('@flow/types').AgentRunStatus });
      continue;
    }

    if (run.status !== 'waiting_approval') {
      failed.push({ runId, error: `Run is '${run.status}', cannot reject` });
      continue;
    }

    const output = (run.output ?? {}) as Record<string, unknown>;
    const { data: updated, error: updateError } = await supabase
      .from('agent_runs')
      .update({
        status: 'cancelled',
        output: { ...output, _rejectionAt: new Date().toISOString() },
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)
      .eq('status', 'waiting_approval')
      .select('id, status')
      .maybeSingle();

    if (updateError || !updated) {
      failed.push({ runId, error: updateError ? 'Database error' : 'Status changed concurrently' });
    } else {
      succeeded.push({ runId, newStatus: 'cancelled' });
    }
  }

  return { success: true, data: { succeeded, failed } };
}
