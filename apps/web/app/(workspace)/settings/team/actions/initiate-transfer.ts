'use server';

import { initiateTransferSchema } from '@flow/types';
import type { ActionResult, TransferRequest } from '@flow/types';
import { createFlowError, requireTenantContext, cacheTag } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { logWorkspaceEvent } from '@/lib/workspace-audit';

export async function initiateTransfer(
  input: unknown,
): Promise<ActionResult<TransferRequest>> {
  const parsed = initiateTransferSchema.safeParse(input);
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

  const { toUserId } = parsed.data;
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

  if (toUserId === ctx.userId) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        'You cannot transfer ownership to yourself.',
        'validation',
      ),
    };
  }

  const { data: targetMember } = await supabase
    .from('workspace_members')
    .select('user_id, role, status')
    .eq('workspace_id', ctx.workspaceId)
    .eq('user_id', toUserId)
    .eq('status', 'active')
    .single();

  if (!targetMember) {
    return {
      success: false,
      error: createFlowError(
        404,
        'NOT_FOUND',
        'Target user is not an active member of this workspace.',
        'validation',
      ),
    };
  }

  if (targetMember.role === 'client_user') {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        'Cannot transfer ownership to a client user.',
        'validation',
      ),
    };
  }

  const { data: pendingTransfer } = await supabase
    .from('transfer_requests')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'pending')
    .maybeSingle();

  if (pendingTransfer) {
    return {
      success: false,
      error: createFlowError(
        409,
        'TRANSFER_ALREADY_PENDING',
        'An ownership transfer is already pending for this workspace.',
        'validation',
      ),
    };
  }

  const { data: transfer, error: insertError } = await supabase
    .from('transfer_requests')
    .insert({
      workspace_id: ctx.workspaceId,
      from_user_id: ctx.userId,
      to_user_id: toUserId,
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return {
        success: false,
        error: createFlowError(
          409,
          'TRANSFER_ALREADY_PENDING',
          'An ownership transfer is already pending for this workspace.',
          'validation',
        ),
      };
    }
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to initiate transfer.',
        'system',
      ),
    };
  }

  revalidateTag(cacheTag('workspace_member', ctx.workspaceId));

  await logWorkspaceEvent({
    type: 'transfer_initiated',
    workspaceId: ctx.workspaceId,
    fromUserId: ctx.userId,
    toUserId,
    transferId: (transfer as unknown as { id: string }).id,
    timestamp: new Date().toISOString(),
  });

  return { success: true, data: transfer as unknown as TransferRequest };
}
