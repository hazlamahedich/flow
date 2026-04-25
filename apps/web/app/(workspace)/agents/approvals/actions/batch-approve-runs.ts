'use server';

import { batchActionSchema } from './schemas';
import type { ActionResult, BatchActionResult, AgentRunStatus } from '@flow/types';
import { parseApprovalOutput } from '@flow/types';
import { createFlowError, requireTenantContext } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';

export async function batchApproveRuns(
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

    if (run.status === 'completed' || run.status === 'cancelled') {
      succeeded.push({ runId, newStatus: run.status as AgentRunStatus });
      continue;
    }

    if (run.status !== 'waiting_approval') {
      failed.push({ runId, error: `Run is '${run.status}', cannot approve` });
      continue;
    }

    const output = run.output as Record<string, unknown> | null;
    const parsedOutput = parseApprovalOutput(output);
    const isTrustBlocked = parsedOutput?.proposalType === 'trust_blocked';
    const newStatus: AgentRunStatus = isTrustBlocked ? 'running' : 'completed';

    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      output: { ...(output ?? {}), _approvalType: isTrustBlocked ? 'trust_unblock' : 'clean_approval' },
    };
    if (newStatus === 'completed') updatePayload.completed_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('agent_runs')
      .update(updatePayload)
      .eq('id', runId)
      .eq('status', 'waiting_approval')
      .select('id, status')
      .maybeSingle();

    if (updateError || !updated) {
      failed.push({ runId, error: updateError ? 'Database error' : 'Status changed concurrently' });
    } else {
      succeeded.push({ runId, newStatus });
    }
  }

  return { success: true, data: { succeeded, failed } };
}
