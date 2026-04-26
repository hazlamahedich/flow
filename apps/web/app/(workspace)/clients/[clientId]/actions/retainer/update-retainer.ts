'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  cacheTag,
  updateRetainer,
  getRetainerById,
} from '@flow/db';
import { updateRetainerSchema } from '@flow/types';
import type { ActionResult, Retainer } from '@flow/types';

export async function updateRetainerAction(
  input: unknown,
): Promise<ActionResult<Retainer>> {
  const parsed = updateRetainerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Invalid update data.', 'validation', {
        issues: parsed.error.issues,
      }),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return {
      success: false,
      error: createFlowError(403, 'INSUFFICIENT_ROLE', 'Only owners and admins can update retainers.', 'auth'),
    };
  }

  const { retainerId, ...updates } = parsed.data;

  const existing = await getRetainerById(supabase, {
    retainerId,
    workspaceId: ctx.workspaceId,
  });

  if (!existing) {
    return { success: false, error: createFlowError(404, 'RETAINER_NOT_FOUND', 'Retainer not found.', 'validation') };
  }

  if (existing.status !== 'active') {
    return { success: false, error: createFlowError(400, 'RETAINER_NOT_ACTIVE', 'Only active retainers can be edited.', 'validation') };
  }

  try {
    const retainer = await updateRetainer(supabase, {
      retainerId,
      workspaceId: ctx.workspaceId,
      data: updates,
    });

    revalidateTag(cacheTag('retainer_agreement', ctx.workspaceId));
    revalidateTag(cacheTag('workspace_client', ctx.workspaceId));
    revalidateTag(cacheTag('dashboard', ctx.workspaceId));
    return { success: true, data: retainer };
  } catch (err: unknown) {
    console.error('[update-retainer] Error:', err);
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const pgErr = err as { code?: string; message?: string };
      if (pgErr.code === 'PGRQ116') {
        return { success: false, error: createFlowError(409, 'RETAINER_NOT_ACTIVE', 'Retainer is no longer active — it may have been cancelled or expired.', 'validation') };
      }
    }
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to update retainer.', 'system'),
    };
  }
}
