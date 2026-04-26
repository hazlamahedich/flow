'use server';

import { revalidateTag } from 'next/cache';
import type { ActionResult } from '@flow/types';
import type { ActionHistoryRow } from '@flow/db';
import { IssueCorrectionSchema } from './correction-schemas';
import { mapRun } from '@flow/db';

async function getTenantClient() {
  const { createServerClient, requireTenantContext } = await import('@flow/db');
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const client = createServerClient({
    getAll: () => cookieStore.getAll().map((c: { name: string; value: string }) => ({ name: c.name, value: c.value })),
    set: () => {},
  });
  const ctx = await requireTenantContext(client);
  return { client, workspaceId: ctx.workspaceId, userId: ctx.userId };
}

function validationError(message: string): ActionResult<{ correctedRunId: string }> {
  return { success: false, error: { status: 400, code: 'VALIDATION_ERROR', message, category: 'validation' } };
}

function validationErrorRun(message: string): ActionResult<ActionHistoryRow> {
  return { success: false, error: { status: 400, code: 'VALIDATION_ERROR', message, category: 'validation' } };
}

export async function issueCorrection(
  input: unknown,
): Promise<ActionResult<{ correctedRunId: string }>> {
  const parsed = IssueCorrectionSchema.safeParse(input);
  if (!parsed.success) return validationError('Invalid input');

  const { originalRunId, correctedOutput } = parsed.data;
  const { client, workspaceId } = await getTenantClient();

  const { data: original, error: fetchErr } = await client
    .from('agent_runs')
    .select('*')
    .eq('id', originalRunId)
    .eq('workspace_id', workspaceId)
    .single();
  if (fetchErr || !original) return validationError('Original run not found');

  if (original.status !== 'completed') return validationError('Only completed runs can be corrected');
  if (!original.error) return validationError('Only runs with errors can be corrected');
  if (original.correction_issued as boolean) return validationError('Correction already issued for this run');

  const currentDepth = (original.correction_depth as number | null) ?? 0;
  if (currentDepth >= 5) return validationError('Maximum correction depth reached');
  const newDepth = currentDepth + 1;
  const { data: corrected, error: insertErr } = await client
    .from('agent_runs')
    .insert({
      workspace_id: original.workspace_id,
      agent_id: original.agent_id,
      job_id: crypto.randomUUID(),
      action_type: original.action_type,
      client_id: original.client_id,
      correlation_id: original.correlation_id,
      source: 'human_correction',
      corrected_run_id: originalRunId,
      correction_depth: newDepth,
      idempotency_key: crypto.randomUUID(),
      status: 'waiting_approval',
      input: original.input,
      output: correctedOutput,
      error: null,
    })
    .select('id')
    .single();
  if (insertErr || !corrected) {
    return { success: false, error: { status: 500, code: 'INTERNAL_ERROR', message: 'Failed to create correction', category: 'system' } };
  }

  const { count } = await client
    .from('agent_runs')
    .update({ correction_issued: true }, { count: 'exact' })
    .eq('id', originalRunId)
    .eq('correction_issued', false);
  if (count === 0) {
    const { error: rollbackErr } = await client.from('agent_runs').delete().eq('id', corrected.id as string);
    if (rollbackErr) {
      console.error('[correction-actions] rollback DELETE failed for correction', corrected.id, rollbackErr);
    }
    return validationError('Correction already issued for this run');
  }

  revalidateTag('agent-activity:' + workspaceId);
  return { success: true, data: { correctedRunId: corrected.id as string } };
}

export async function getOriginalRunForCorrection(
  runId: string,
): Promise<ActionResult<ActionHistoryRow>> {
  const { client, workspaceId } = await getTenantClient();

  const { data, error } = await client
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .eq('workspace_id', workspaceId)
    .single();
  if (error || !data) {
    return { success: false, error: { status: 404, code: 'NOT_FOUND', message: 'Run not found', category: 'system' } };
  }
  if (data.status !== 'completed') {
    return validationErrorRun('Only completed runs can be corrected');
  }
  if (!data.error) {
    return validationErrorRun('Only runs with errors can be corrected');
  }

  return { success: true, data: { ...mapRun(data as Record<string, unknown>), feedback: null } };
}
