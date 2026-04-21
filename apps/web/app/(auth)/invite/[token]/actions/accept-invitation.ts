'use server';

import { z } from 'zod';
import { createHash } from 'crypto';
import type { ActionResult } from '@flow/types';
import { createFlowError, cacheTag } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { logWorkspaceEvent } from '@/lib/workspace-audit';

const acceptSchema = z.object({
  token: z.string().uuid(),
});

export async function acceptInvitation(
  input: FormData | unknown,
): Promise<ActionResult<{ workspaceId: string }>> {
  const rawInput = input instanceof FormData
    ? { token: input.get('token') as string }
    : input;
  const parsed = acceptSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid token',
        'validation',
      ),
    };
  }

  const { token } = parsed.data;
  const supabase = await getServerSupabase();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return {
      success: false,
      error: createFlowError(
        401,
        'AUTH_REQUIRED',
        'Please sign in to accept this invitation.',
        'auth',
      ),
    };
  }

  const { data: workspaceId, error: rpcError } = await supabase.rpc(
    'accept_invitation',
    { p_token: token },
  );

  if (rpcError) {
    const msg = rpcError.message.toLowerCase();
    if (msg.includes('expired')) {
      return {
        success: false,
        error: createFlowError(
          410,
          'INVITATION_EXPIRED',
          'This invitation has expired. Contact your workspace owner for a new one.',
          'validation',
        ),
      };
    }
    if (msg.includes('already accepted') || msg.includes('already a member')) {
      return {
        success: false,
        error: createFlowError(
          409,
          'INVITATION_ALREADY_ACCEPTED',
          'This invitation has already been accepted.',
          'validation',
        ),
      };
    }
    if (msg.includes('not found') || msg.includes('not addressed')) {
      return {
        success: false,
        error: createFlowError(
          404,
          'INVITATION_NOT_FOUND',
          'Invitation not found or not addressed to you.',
          'validation',
        ),
      };
    }
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to accept invitation.',
        'system',
      ),
    };
  }

  if (workspaceId && typeof workspaceId === 'string') {
    revalidateTag(cacheTag('workspace_member', workspaceId));
    revalidateTag(cacheTag('workspace_invitation', workspaceId));

    const { data: invitationRecord } = await supabase
      .from('workspace_invitations')
      .select('invited_by, role')
      .eq('workspace_id', workspaceId)
      .eq('email', session.user.email ?? '')
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    await logWorkspaceEvent({
      type: 'member_joined',
      workspaceId,
      email: session.user.email ?? '',
      role: invitationRecord?.role ?? '',
      invitedBy: invitationRecord?.invited_by ?? '',
      timestamp: new Date().toISOString(),
    });

    return { success: true, data: { workspaceId } };
  }

  return {
    success: false,
    error: createFlowError(
      500,
      'INTERNAL_ERROR',
      'Unexpected response from invitation acceptance.',
      'system',
    ),
  };
}
