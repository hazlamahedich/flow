'use server';

import { revokeMemberSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import { createFlowError, requireTenantContext, cacheTag } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { logWorkspaceEvent } from '@/lib/workspace-audit';
import { invalidateUserSessions } from '@flow/auth/server-admin';

export async function revokeMember(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = revokeMemberSchema.safeParse(input);
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

  const { memberId } = parsed.data;
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

  if (targetMember.role === 'owner') {
    const { count } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('role', 'owner')
      .eq('status', 'active');

    if (count !== null && count <= 1) {
      return {
        success: false,
        error: createFlowError(
          400,
          'VALIDATION_ERROR',
          'Cannot revoke the last owner.',
          'validation',
        ),
      };
    }
  }

  if (targetMember.user_id === ctx.userId) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        'You cannot revoke your own access.',
        'validation',
      ),
    };
  }

  const { error: revokeError } = await supabase
    .from('workspace_members')
    .update({
      status: 'revoked',
      removed_at: new Date().toISOString(),
    })
    .eq('id', memberId)
    .eq('workspace_id', ctx.workspaceId);

  if (revokeError) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to revoke member.',
        'system',
      ),
    };
  }

  const { error: clientAccessError } = await supabase
    .from('member_client_access')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', targetMember.user_id)
    .eq('workspace_id', ctx.workspaceId)
    .is('revoked_at', null);

  if (clientAccessError) {
    console.error('Failed to revoke client access during member revocation:', clientAccessError);
  }

  try {
    await invalidateUserSessions(targetMember.user_id);
  } catch {
    // Session invalidation best-effort
  }

  revalidateTag(cacheTag('workspace_member', ctx.workspaceId));
  revalidateTag(cacheTag('workspace_client', ctx.workspaceId));

  try {
    await logWorkspaceEvent({
      type: 'member_revoked',
      workspaceId: ctx.workspaceId,
      memberId,
      revokedBy: ctx.userId,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Audit logging best-effort — do not fail the action
  }

  try {
    await logWorkspaceEvent({
      type: 'member_sessions_invalidated',
      workspaceId: ctx.workspaceId,
      userId: targetMember.user_id,
      reason: 'member_revoked',
      triggeredBy: ctx.userId,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Audit logging best-effort — do not fail the action
  }

  return { success: true, data: undefined };
}
