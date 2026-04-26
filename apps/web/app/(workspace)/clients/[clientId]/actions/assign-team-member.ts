'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, cacheTag, assignMemberToClient } from '@flow/db';
import { scopeClientAccessSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';

export async function assignTeamMember(
  input: unknown,
): Promise<ActionResult<{ userId: string; clientId: string }>> {
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
      error: createFlowError(403, 'INSUFFICIENT_ROLE', 'Only owners and admins can assign members.', 'auth'),
    };
  }

  try {
    await assignMemberToClient(supabase, {
      workspaceId: ctx.workspaceId,
      userId: parsed.data.userId,
      clientId: parsed.data.clientId,
      grantedBy: ctx.userId,
    });

    revalidateTag(cacheTag('workspace_client', ctx.workspaceId));
    return { success: true, data: { userId: parsed.data.userId, clientId: parsed.data.clientId } };
  } catch {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to assign member.', 'system'),
    };
  }
}
