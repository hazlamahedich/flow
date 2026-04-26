'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  cacheTag,
  cancelRetainer,
  getRetainerById,
} from '@flow/db';
import { cancelRetainerSchema } from '@flow/types';
import type { ActionResult, Retainer } from '@flow/types';

export async function cancelRetainerAction(
  input: unknown,
): Promise<ActionResult<Retainer>> {
  const parsed = cancelRetainerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Invalid cancel data.', 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return {
      success: false,
      error: createFlowError(403, 'INSUFFICIENT_ROLE', 'Only owners and admins can end retainers.', 'auth'),
    };
  }

  const existing = await getRetainerById(supabase, {
    retainerId: parsed.data.retainerId,
    workspaceId: ctx.workspaceId,
  });

  if (!existing) {
    return { success: false, error: createFlowError(404, 'RETAINER_NOT_FOUND', 'Retainer not found.', 'validation') };
  }

  try {
    const retainer = await cancelRetainer(supabase, {
      retainerId: parsed.data.retainerId,
      workspaceId: ctx.workspaceId,
      ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
    });

    revalidateTag(cacheTag('retainer_agreement', ctx.workspaceId));
    revalidateTag(cacheTag('workspace_client', ctx.workspaceId));
    revalidateTag(cacheTag('dashboard', ctx.workspaceId));
    return { success: true, data: retainer };
  } catch (err: unknown) {
    console.error('[cancel-retainer] Error:', err);
    if (err instanceof Error && err.message === 'RETAINER_NOT_ACTIVE') {
      return {
        success: false,
        error: createFlowError(400, 'RETAINER_NOT_ACTIVE', 'Only active retainers can be cancelled.', 'validation'),
      };
    }
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to end retainer.', 'system'),
    };
  }
}
