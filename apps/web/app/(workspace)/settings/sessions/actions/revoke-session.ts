'use server';

import { revokeSessionSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import { createFlowError, requireTenantContext, cacheTag } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { logWorkspaceEvent } from '@/lib/workspace-audit';
import { invalidateUserSessions } from '@flow/auth/server-admin';

export async function revokeSession(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = revokeSessionSchema.safeParse(input);
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

  const { deviceId } = parsed.data;
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

  const { createServiceClient } = await import('@flow/db/client');
  const serviceClient = createServiceClient();

  const { data: device } = await serviceClient
    .from('user_devices')
    .select('user_id, is_revoked')
    .eq('id', deviceId)
    .single();

  if (!device || device.is_revoked) {
    return {
      success: false,
      error: createFlowError(
        404,
        'NOT_FOUND',
        'Active session not found.',
        'validation',
      ),
    };
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('user_id', device.user_id)
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) {
    return {
      success: false,
      error: createFlowError(
        404,
        'NOT_FOUND',
        'Session does not belong to a workspace member.',
        'validation',
      ),
    };
  }

  if (device.user_id === ctx.userId) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        'You cannot revoke your own session.',
        'validation',
      ),
    };
  }

  const { error: revokeError } = await serviceClient
    .from('user_devices')
    .update({ is_revoked: true })
    .eq('id', deviceId);

  if (revokeError) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        "Couldn't revoke session. Please try again.",
        'system',
      ),
    };
  }

  let invalidationSucceeded = true;
  try {
    await invalidateUserSessions(device.user_id);
  } catch {
    invalidationSucceeded = false;
  }

  revalidateTag(cacheTag('workspace_session', ctx.workspaceId));

  try {
    await logWorkspaceEvent({
      type: 'session_revoked_by_owner',
      workspaceId: ctx.workspaceId,
      userId: device.user_id,
      deviceId,
      invalidated: invalidationSucceeded,
      revokedBy: ctx.userId,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Audit logging best-effort — do not fail the action
  }

  if (!invalidationSucceeded) {
    return { success: true, data: undefined };
  }

  return { success: true, data: undefined };
}
