'use server';

import { revalidateTag } from 'next/cache';
import type { ActionResult } from '@flow/types';
import {
  setTrustLevelSchema,
  createPreconditionSchema,
  deletePreconditionSchema,
} from './schema';
import {
  getTrustMatrix,
  getTrustMatrixEntry,
  updateTrustMatrixEntry,
  upsertPrecondition,
  deletePrecondition,
  insertTransition,
  upsertTrustMatrixEntry,
} from '@flow/db';

async function getTenantWorkspaceId(): Promise<string> {
  const { createServerClient, requireTenantContext } = await import('@flow/db');
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const client = createServerClient({
    getAll: () => cookieStore.getAll().map((c: { name: string; value: string }) => ({ name: c.name, value: c.value })),
    set: () => {},
  });
  const ctx = await requireTenantContext(client);
  return ctx.workspaceId;
}

export async function setTrustLevel(input: unknown): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = setTrustLevelSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid input', category: 'validation' } };
  }

  const { agentId, actionType, level, expectedVersion } = parsed.data;
  const workspaceId = await getTenantWorkspaceId();
  const now = new Date();
  const cooldownUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    let entry = await getTrustMatrixEntry(workspaceId, agentId, actionType);
    if (!entry) {
      entry = await upsertTrustMatrixEntry(workspaceId, agentId, actionType);
    }

    const updated = await updateTrustMatrixEntry(
      entry.id,
      {
        current_level: level,
        cooldown_until: cooldownUntil,
        last_transition_at: now.toISOString(),
      },
      expectedVersion,
    );

    await insertTransition({
      matrix_entry_id: updated.id,
      workspace_id: workspaceId,
      from_level: entry.current_level,
      to_level: level,
      trigger_type: 'manual_override',
      trigger_reason: `Manual override to ${level}`,
      is_context_shift: false,
      snapshot: { level, score: updated.score, version: expectedVersion },
      actor: `va:${workspaceId}`,
    });

    revalidateTag('trust:' + workspaceId);
    return { success: true, data: updated as unknown as Record<string, unknown> };
  } catch {
    return { success: false, error: { status: 409, code: 'CONFLICT', message: 'Version mismatch — trust state was modified by another process', category: 'system' } };
  }
}

export async function createPrecondition(input: unknown): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = createPreconditionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid input', category: 'validation' } };
  }

  const workspaceId = await getTenantWorkspaceId();
  const { agentId, actionType, conditionKey, conditionExpr } = parsed.data;

  try {
    const result = await upsertPrecondition(workspaceId, agentId, actionType, conditionKey, conditionExpr);
    revalidateTag('trust:' + workspaceId);
    return { success: true, data: result as unknown as Record<string, unknown> };
  } catch {
    return { success: false, error: { status: 500, code: 'INTERNAL_ERROR', message: 'Failed to save precondition', category: 'system' } };
  }
}

export async function deletePreconditionAction(input: unknown): Promise<ActionResult<{ deleted: boolean }>> {
  const parsed = deletePreconditionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid input', category: 'validation' } };
  }

  const workspaceId = await getTenantWorkspaceId();

  try {
    await deletePrecondition(parsed.data.id);
    revalidateTag('trust:' + workspaceId);
    return { success: true, data: { deleted: true } };
  } catch {
    return { success: false, error: { status: 500, code: 'INTERNAL_ERROR', message: 'Failed to delete precondition', category: 'system' } };
  }
}

export async function getTrustMatrixAction(): Promise<ActionResult<Record<string, unknown>[]>> {
  const workspaceId = await getTenantWorkspaceId();
  const matrix = await getTrustMatrix(workspaceId);
  return { success: true, data: matrix as unknown as Record<string, unknown>[] };
}
