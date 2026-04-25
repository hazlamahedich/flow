'use server';

import { updateProposalSchema } from './schemas';
import type { ActionResult, ApprovalResult } from '@flow/types';
import { createFlowError, requireTenantContext } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';

export async function updateProposal(
  input: unknown,
): Promise<ActionResult<ApprovalResult>> {
  const parsed = updateProposalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 'validation'),
    };
  }

  const { runId, title, confidence, riskLevel } = parsed.data;
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

  if (run.status !== 'waiting_approval') {
    return {
      success: false,
      error: createFlowError(409, 'CONFLICT', 'This proposal changed since you started editing.', 'validation'),
    };
  }

  const output = (run.output ?? {}) as Record<string, unknown>;
  const diff: Record<string, unknown> = {};

  if (title !== undefined && title !== output.title) {
    diff.title = { from: output.title, to: title };
    output.title = title;
  }
  if (confidence !== undefined && confidence !== output.confidence) {
    const clamped = Math.max(0, Math.min(1, confidence));
    diff.confidence = { from: output.confidence, to: clamped };
    output.confidence = clamped;
  }
  if (riskLevel !== undefined && riskLevel !== output.riskLevel) {
    diff.riskLevel = { from: output.riskLevel, to: riskLevel };
    output.riskLevel = riskLevel;
  }

  if (Object.keys(diff).length === 0) {
    return {
      success: true,
      data: { runId, newStatus: 'waiting_approval' },
    };
  }

  output._editDiff = diff;
  output._editedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from('agent_runs')
    .update({ output })
    .eq('id', runId)
    .eq('status', 'waiting_approval')
    .select('id, status')
    .maybeSingle();

  if (updateError) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to update proposal', 'system'),
    };
  }

  if (!updated) {
    return {
      success: false,
      error: createFlowError(409, 'CONFLICT', 'This proposal changed since you started editing.', 'validation'),
    };
  }

  return {
    success: true,
    data: { runId, newStatus: 'waiting_approval' },
  };
}
