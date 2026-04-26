'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, cacheTag, revokeMemberAccess } from '@flow/db';
import { scopeClientAccessSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';

export async function revokeTeamMember(
  input: unknown,
): Promise<ActionResult<{ revokedCount: number }>> {
  const parsed = scopeClientAccessSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Invalid input.', 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return {
      success: false,
      error: createFlowError(403, 'INSUFFICIENT_ROLE', 'Only owners and admins can revoke access.', 'auth'),
    };
  }

  try {
    const revokedCount = await revokeMemberAccess(supabase, {
      workspaceId: ctx.workspaceId,
      userId: parsed.data.userId,
      clientId: parsed.data.clientId,
    });

    if (revokedCount === 0) {
      return {
        success: false,
        error: createFlowError(404, 'NOT_FOUND', 'No active access to revoke.', 'validation'),
      };
    }

    revalidateTag(cacheTag('workspace_client', ctx.workspaceId));
    return { success: true, data: { revokedCount } };
  } catch {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to revoke member access.', 'system'),
    };
  }
}
