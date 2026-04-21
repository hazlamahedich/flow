'use server';

import { createHash, randomUUID } from 'crypto';
import { inviteMemberSchema } from '@flow/types';
import type { ActionResult, WorkspaceInvitation } from '@flow/types';
import { createFlowError, requireTenantContext, cacheTag } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { checkRateLimit, INVITATION_CONFIG } from '@/lib/rate-limit';
import { logWorkspaceEvent } from '@/lib/workspace-audit';

async function sendInvitationEmail(
  email: string,
  _workspaceName: string,
  token: string,
): Promise<void> {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const inviteUrl = `${origin}/invite/${token}`;

  const { createServiceClient } = await import('@flow/db/client');
  const serviceClient = createServiceClient();
  await serviceClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteUrl,
  });
}

export async function inviteMember(
  input: unknown,
): Promise<ActionResult<WorkspaceInvitation>> {
  const parsed = inviteMemberSchema.safeParse(input);
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

  const { email, role, expiresAt } = parsed.data;
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role === 'member') {
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

  if (ctx.role === 'admin' && role === 'admin') {
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

  const { data: currentUser } = await supabase.auth.getUser();
  if (currentUser?.user?.email?.toLowerCase() === email.toLowerCase()) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        'You cannot invite yourself.',
        'validation',
      ),
    };
  }

  const rateResult = await checkRateLimit(
    `workspace_invitations:${ctx.workspaceId}`,
    INVITATION_CONFIG,
    'workspace_invitation',
  );
  if (!rateResult.allowed) {
    return {
      success: false,
      error: createFlowError(
        429,
        'RATE_LIMITED',
        `Too many invitations. Please try again in ${Math.ceil(rateResult.retryAfterMs / 1000)} seconds.`,
        'auth',
      ),
    };
  }

  const token = randomUUID();
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const { data: existingInvitation } = await supabase
    .from('workspace_invitations')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existingInvitation) {
    const { data: updated, error: updateError } = await supabase
      .from('workspace_invitations')
      .update({
        token_hash: tokenHash,
        role,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        invited_by: ctx.userId,
        membership_expires_at: expiresAt ?? null,
      })
      .eq('id', existingInvitation.id)
      .select()
      .single();

    if (updateError || !updated) {
      return {
        success: false,
        error: createFlowError(
          500,
          'INTERNAL_ERROR',
          'Failed to resend invitation.',
          'system',
        ),
      };
    }

    await sendInvitationEmail(email, '', token);

    revalidateTag(cacheTag('workspace_invitation', ctx.workspaceId));
    revalidateTag(cacheTag('workspace_member', ctx.workspaceId));

    await logWorkspaceEvent({
      type: 'member_invited',
      workspaceId: ctx.workspaceId,
      email,
      role,
      invitedBy: ctx.userId,
      timestamp: new Date().toISOString(),
    });

    return { success: true, data: updated as unknown as WorkspaceInvitation };
  }

  const { data: newInvitation, error: insertError } = await supabase
    .from('workspace_invitations')
    .insert({
      workspace_id: ctx.workspaceId,
      email: email.toLowerCase(),
      role,
      token_hash: tokenHash,
      invited_by: ctx.userId,
      membership_expires_at: expiresAt ?? null,
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return {
        success: false,
        error: createFlowError(
          409,
          'MEMBER_ALREADY_EXISTS',
          `[${email}] is already a member of this workspace.`,
          'validation',
        ),
      };
    }
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to create invitation.',
        'system',
      ),
    };
  }

  await sendInvitationEmail(email, '', token);

  revalidateTag(cacheTag('workspace_invitation', ctx.workspaceId));
  revalidateTag(cacheTag('workspace_member', ctx.workspaceId));

  await logWorkspaceEvent({
    type: 'member_invited',
    workspaceId: ctx.workspaceId,
    email,
    role,
    invitedBy: ctx.userId,
    timestamp: new Date().toISOString(),
  });

  return { success: true, data: newInvitation as unknown as WorkspaceInvitation };
}
