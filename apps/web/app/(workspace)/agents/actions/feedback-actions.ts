'use server';

import { revalidateTag } from 'next/cache';
import type { ActionResult } from '@flow/types';
import type { FeedbackRow } from '@flow/db';
import { SubmitFeedbackSchema, DeleteFeedbackSchema } from './feedback-schemas';

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

function validationError(message: string): ActionResult<FeedbackRow> {
  return { success: false, error: { status: 400, code: 'VALIDATION_ERROR', message, category: 'validation' } };
}

export async function submitFeedback(
  input: unknown,
): Promise<ActionResult<FeedbackRow>> {
  const parsed = SubmitFeedbackSchema.safeParse(input);
  if (!parsed.success) return validationError('Invalid input');

  const { runId, sentiment, note } = parsed.data;
  const { client, workspaceId, userId } = await getTenantClient();

  const { data: owned } = await client
    .from('agent_runs')
    .select('id, agent_id')
    .eq('id', runId)
    .eq('workspace_id', workspaceId)
    .single();
  if (!owned) return validationError('Run not found in this workspace');

  const { data, error } = await client
    .from('agent_feedback')
    .upsert(
      { run_id: runId, user_id: userId, workspace_id: workspaceId, sentiment, note: note ?? null },
      { onConflict: 'run_id,user_id' },
    )
    .select('id, sentiment, note, created_at')
    .single();
  if (error) {
    return { success: false, error: { status: 500, code: 'INTERNAL_ERROR', message: 'Failed to submit feedback', category: 'system' } };
  }

  const feedback: FeedbackRow = {
    id: data.id as string,
    sentiment: data.sentiment as 'positive' | 'negative',
    note: (data.note as string | null) ?? null,
    createdAt: data.created_at as string,
  };

  try {
    const { createServiceClient } = await import('@flow/db');
    const svc = createServiceClient();
    await svc.from('pgboss_jobs').insert({
      name: 'trust:recalculate',
      data: { workspaceId, agentId: owned.agent_id, runId },
    });
  } catch (jobErr) {
    console.error('[feedback-actions] trust:recalculate job enqueue failed:', jobErr);
  }

  revalidateTag('agent-activity:' + workspaceId);
  return { success: true, data: feedback };
}

export async function deleteFeedback(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = DeleteFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid input', category: 'validation' } };
  }

  const { feedbackId } = parsed.data;
  const { client, workspaceId } = await getTenantClient();

  const { data: feedback } = await client
    .from('agent_feedback')
    .select('id, run_id, workspace_id')
    .eq('id', feedbackId)
    .eq('workspace_id', workspaceId)
    .single();
  if (!feedback) {
    return { success: false, error: { status: 404, code: 'NOT_FOUND', message: 'Feedback not found', category: 'system' } };
  }

  const { error, count } = await client
    .from('agent_feedback')
    .delete({ count: 'exact' })
    .eq('id', feedbackId);
  if (error) {
    const isRlsDeny = error.code === '42501';
    return {
      success: false,
      error: {
        status: isRlsDeny ? 403 : 500,
        code: isRlsDeny ? 'FORBIDDEN' : 'INTERNAL_ERROR',
        message: isRlsDeny ? 'Only admins can delete feedback' : 'Failed to delete feedback',
        category: isRlsDeny ? 'auth' : 'system',
      },
    };
  }
  if (count === 0) {
    return {
      success: false,
      error: { status: 403, code: 'FORBIDDEN', message: 'Only admins can delete feedback', category: 'auth' },
    };
  }

  try {
    const { data: run } = await client
      .from('agent_runs')
      .select('agent_id')
      .eq('id', feedback.run_id as string)
      .single();
    if (run) {
      const { createServiceClient } = await import('@flow/db');
      const svc = createServiceClient();
      await svc.from('pgboss_jobs').insert({
        name: 'trust:recalculate',
        data: { workspaceId, agentId: run.agent_id, runId: feedback.run_id as string },
      });
    }
  } catch (jobErr) {
    console.error('[feedback-actions] trust:recalculate job enqueue failed on delete:', jobErr);
  }

  revalidateTag('agent-activity:' + workspaceId);
  return { success: true, data: undefined };
}
