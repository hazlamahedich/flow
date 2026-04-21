'use server';

import { z } from 'zod';
import type { ActionResult } from '@flow/types';
import { createFlowError, requireTenantContext, cacheTag } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';

const resendInvitationSchema = z.object({
  invitationId: z.string().uuid(),
});

export async function resendInvitation(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = resendInvitationSchema.safeParse(input);
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

  const { invitationId } = parsed.data;
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
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

  const { data: invitation } = await supabase
    .from('workspace_invitations')
    .select('email, role')
    .eq('id', invitationId)
    .eq('workspace_id', ctx.workspaceId)
    .is('accepted_at', null)
    .maybeSingle();

  if (!invitation) {
    return {
      success: false,
      error: createFlowError(
        404,
        'NOT_FOUND',
        'Pending invitation not found.',
        'validation',
      ),
    };
  }

  const { error: updateError } = await supabase
    .from('workspace_invitations')
    .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
    .eq('id', invitationId);

  if (updateError) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        "Couldn't resend invitation. Please try again.",
        'system',
      ),
    };
  }

  revalidateTag(cacheTag('workspace_invitation', ctx.workspaceId));

  try {
    const { logWorkspaceEvent } = await import('@/lib/workspace-audit');
    await logWorkspaceEvent({
      type: 'invitation_resent',
      workspaceId: ctx.workspaceId,
      invitationId,
      email: invitation.email,
      resentBy: ctx.userId,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Audit logging best-effort — do not fail the action
  }

  return { success: true, data: undefined };
}
