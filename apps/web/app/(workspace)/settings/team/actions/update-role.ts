'use server';

import { updateRoleSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import { createFlowError, requireTenantContext, cacheTag } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { logWorkspaceEvent } from '@/lib/workspace-audit';
import { invalidateUserSessions } from '@flow/auth/server-admin';

export async function updateRole(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid input',
        'validation',
      ),
    };
  }

  const { memberId, role } = parsed.data;
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role !== 'owner') {
    return {
      success: false,
      error: createFlowError(
        403,
        'INSUFFICIENT_ROLE',
        "You don't have permission to perform this action.",
        'auth',
      ),
    };
  }

  if (role === 'owner') {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        'Use ownership transfer to change the owner role.',
        'validation',
      ),
    };
  }

  const { data: targetMember } = await supabase
    .from('workspace_members')
    .select('user_id, role, status')
    .eq('id', memberId)
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'active')
    .single();

  if (!targetMember) {
    return {
      success: false,
      error: createFlowError(
        404,
        'NOT_FOUND',
        'Active membership not found.',
        'validation',
      ),
    };
  }

  if (targetMember.user_id === ctx.userId) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        'You cannot change your own role.',
        'validation',
      ),
    };
  }

  const previousRole = targetMember.role as string;

  const { error: updateError } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('id', memberId)
    .eq('workspace_id', ctx.workspaceId);

  if (updateError) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to update role.',
        'system',
      ),
    };
  }

  if (previousRole !== role) {
    try {
      await invalidateUserSessions(targetMember.user_id);
    } catch {
      // Session invalidation best-effort; JWT window handles enforcement
    }
  }

  revalidateTag(cacheTag('workspace_member', ctx.workspaceId));

  await logWorkspaceEvent({
    type: 'member_role_changed',
    workspaceId: ctx.workspaceId,
    memberId,
    oldRole: previousRole,
    newRole: role,
    changedBy: ctx.userId,
    timestamp: new Date().toISOString(),
  });

  return { success: true, data: undefined };
}
