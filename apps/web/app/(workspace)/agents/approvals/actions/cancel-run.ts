'use server';

import { cancelRunSchema } from './schemas';
import type { ActionResult, ApprovalResult, AgentRunStatus } from '@flow/types';
import { createFlowError, requireTenantContext } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';

export async function cancelRun(
  input: unknown,
): Promise<ActionResult<ApprovalResult>> {
  const parsed = cancelRunSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 'validation'),
    };
  }

  const { runId } = parsed.data;
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const { data: run, error: selectError } = await supabase
    .from('agent_runs')
    .select('id, status, workspace_id')
    .eq('id', runId)
    .eq('workspace_id', ctx.workspaceId)
    .single();

  if (selectError || !run) {
    return {
      success: false,
      error: createFlowError(404, 'NOT_FOUND', 'Run not found', 'validation'),
    };
  }

  if (run.status === 'cancelled') {
    return {
      success: true,
      data: { runId, newStatus: 'cancelled' as AgentRunStatus, alreadyProcessed: true },
    };
  }

  if (run.status !== 'timed_out') {
    return {
      success: false,
      error: createFlowError(409, 'CONFLICT', `Run is in '${run.status}' status, can only cancel timed_out runs`, 'validation'),
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from('agent_runs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .eq('status', 'timed_out')
    .select('id, status')
    .maybeSingle();

  if (updateError) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to cancel run', 'system'),
    };
  }

  if (!updated) {
    const { data: current } = await supabase
      .from('agent_runs')
      .select('status')
      .eq('id', runId)
      .single();

    if (current && current.status === 'cancelled') {
      return {
        success: true,
        data: { runId, newStatus: 'cancelled' as AgentRunStatus, alreadyProcessed: true },
      };
    }

    return {
      success: false,
      error: createFlowError(409, 'CONFLICT', 'Run status changed concurrently', 'validation'),
    };
  }

  return {
    success: true,
    data: { runId, newStatus: 'cancelled' },
  };
}
