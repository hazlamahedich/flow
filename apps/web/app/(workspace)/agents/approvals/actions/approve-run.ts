'use server';

import { approveRunSchema } from './schemas';
import type { ActionResult, ApprovalResult, AgentRunStatus } from '@flow/types';
import { parseApprovalOutput } from '@flow/types';
import { createFlowError, requireTenantContext } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';

export async function approveRun(
  input: unknown,
): Promise<ActionResult<ApprovalResult>> {
  const parsed = approveRunSchema.safeParse(input);
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
    .select('id, status, output, workspace_id')
    .eq('id', runId)
    .eq('workspace_id', ctx.workspaceId)
    .single();

  if (selectError || !run) {
    return {
      success: false,
      error: createFlowError(404, 'NOT_FOUND', 'Run not found', 'validation'),
    };
  }

  if (run.status === 'completed' || run.status === 'cancelled') {
    return {
      success: true,
      data: { runId, newStatus: run.status as AgentRunStatus, alreadyProcessed: true },
    };
  }

  if (run.status !== 'waiting_approval') {
    return {
      success: false,
      error: createFlowError(409, 'CONFLICT', `Run is in '${run.status}' status, cannot approve`, 'validation'),
    };
  }

  const output = run.output as Record<string, unknown> | null;
  const parsedOutput = parseApprovalOutput(output);
  const isTrustBlocked = parsedOutput?.proposalType === 'trust_blocked';

  const newStatus: AgentRunStatus = isTrustBlocked ? 'running' : 'completed';

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    output: { ...(output ?? {}), _approvalType: isTrustBlocked ? 'trust_unblock' : 'clean_approval' },
  };

  if (newStatus === 'completed') {
    updatePayload.completed_at = new Date().toISOString();
  }

  const { data: updated, error: updateError } = await supabase
    .from('agent_runs')
    .update(updatePayload)
    .eq('id', runId)
    .eq('status', 'waiting_approval')
    .select('id, status')
    .maybeSingle();

  if (updateError) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to approve run', 'system'),
    };
  }

  if (!updated) {
    const { data: current } = await supabase
      .from('agent_runs')
      .select('status')
      .eq('id', runId)
      .single();

    if (current && (current.status === 'completed' || current.status === 'cancelled')) {
      return {
        success: true,
        data: { runId, newStatus: current.status as AgentRunStatus, alreadyProcessed: true },
      };
    }

    return {
      success: false,
      error: createFlowError(409, 'CONFLICT', 'Run status changed concurrently', 'validation'),
    };
  }

  return {
    success: true,
    data: { runId, newStatus },
  };
}
