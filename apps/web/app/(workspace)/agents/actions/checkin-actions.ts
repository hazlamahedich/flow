'use server';

import { revalidateTag } from 'next/cache';
import type { ActionResult } from '@flow/types';
import { DeferCheckInSchema, AcknowledgeCheckInSchema } from './checkin-schemas';

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

function actionError(message: string, status: number): ActionResult<never> {
  return { success: false, error: { status, code: 'INTERNAL_ERROR', message, category: 'system' } };
}

function validationError(message: string): ActionResult<never> {
  return { success: false, error: { status: 400, code: 'VALIDATION_ERROR', message, category: 'validation' } };
}

export async function deferCheckIn(
  input: unknown,
): Promise<ActionResult<{ deferredCount: number; nextCheckIn: string | null; pinned: boolean }>> {
  const parsed = DeferCheckInSchema.safeParse(input);
  if (!parsed.success) return validationError('Invalid input');

  const { workspaceId, agentId } = parsed.data;
  const { client, workspaceId: ctxWs } = await getTenantClient();

  if (workspaceId !== ctxWs) {
    return validationError('Workspace mismatch');
  }

  const { data, error } = await client.rpc('defer_trust_checkin', {
    p_workspace_id: workspaceId,
    p_agent_id: agentId,
  });

  if (error) return actionError('Failed to defer check-in', 500);

  const result = Array.isArray(data) ? data[0] : data;

  revalidateTag('trust:' + workspaceId);

  if (result?.pinned) {
    return {
      success: true,
      data: {
        deferredCount: result.deferred_count ?? 3,
        nextCheckIn: null,
        pinned: true,
      },
    };
  }

  return {
    success: true,
    data: {
      deferredCount: result?.deferred_count ?? 0,
      nextCheckIn: result?.next_checkin ?? null,
      pinned: false,
    },
  };
}

export async function acknowledgeCheckIn(
  input: unknown,
): Promise<ActionResult<{ reviewedAt: string }>> {
  const parsed = AcknowledgeCheckInSchema.safeParse(input);
  if (!parsed.success) return validationError('Invalid input');

  const { workspaceId, agentId } = parsed.data;
  const { client, workspaceId: ctxWs } = await getTenantClient();

  if (workspaceId !== ctxWs) {
    return validationError('Workspace mismatch');
  }

  const today = new Date().toISOString();
  const { data: existing } = await client
    .from('trust_audits')
    .select('last_reviewed_at, review_count')
    .eq('workspace_id', workspaceId)
    .eq('agent_id', agentId)
    .maybeSingle();

  if (existing?.last_reviewed_at) {
    const lastReviewed = new Date(existing.last_reviewed_at);
    const now = new Date();
    if (
      lastReviewed.getUTCFullYear() === now.getUTCFullYear() &&
      lastReviewed.getUTCMonth() === now.getUTCMonth() &&
      lastReviewed.getUTCDate() === now.getUTCDate()
    ) {
      revalidateTag('trust:' + workspaceId);
      return { success: true, data: { reviewedAt: existing.last_reviewed_at } };
    }
  }

  const { error } = await client
    .from('trust_audits')
    .upsert(
      {
        workspace_id: workspaceId,
        agent_id: agentId,
        deferred_count: 0,
        last_deferred_at: null,
        last_reviewed_at: today,
        review_count: existing ? 0 : 1,
      },
      {
        onConflict: 'workspace_id,agent_id',
        ignoreDuplicates: false,
      },
    );

  if (error) return actionError('Failed to acknowledge check-in', 500);

  if (existing) {
    const { error: updateError } = await client
      .from('trust_audits')
      .update({
        deferred_count: 0,
        last_deferred_at: null,
        last_reviewed_at: today,
        review_count: existing.review_count + 1,
      })
      .eq('workspace_id', workspaceId)
      .eq('agent_id', agentId);

    if (updateError) return actionError('Failed to acknowledge check-in', 500);
  }

  revalidateTag('trust:' + workspaceId);
  return { success: true, data: { reviewedAt: today } };
}

export async function fetchRecentAutoActions(
  input: { workspaceId: string; agentId: string },
): Promise<ActionResult<import('@flow/db').AutoActionRow[]>> {
  const { workspaceId, agentId } = input;
  const { workspaceId: ctxWs } = await getTenantClient();

  if (workspaceId !== ctxWs) {
    return validationError('Workspace mismatch');
  }

  const { getRecentAutoActions } = await import('@flow/db');
  const actions = await getRecentAutoActions(workspaceId, agentId);
  return { success: true, data: actions };
}
