'use server';

import { confirmTransferSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import type { FlowError } from '@flow/types';
import { createFlowError, requireTenantContext, cacheTag } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { logWorkspaceEvent } from '@/lib/workspace-audit';
import { invalidateUserSessions, executeOwnershipTransfer } from '@flow/auth';

export async function confirmTransfer(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = confirmTransferSchema.safeParse(input);
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

  const { transferId } = parsed.data;
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const result = await executeOwnershipTransfer({
    transferId,
    workspaceId: ctx.workspaceId,
    confirmingUserId: ctx.userId,
  });

  if (!result.success) {
    const errorMap: Record<string, FlowError> = {
      transfer_not_found: createFlowError(404, 'TRANSFER_NOT_FOUND', 'Transfer request not found.', 'validation'),
      not_pending: createFlowError(400, 'VALIDATION_ERROR', 'Transfer is not pending.', 'validation'),
      expired: createFlowError(410, 'TRANSFER_EXPIRED', "The transfer wasn't confirmed in time. Your ownership is unchanged.", 'validation'),
      not_recipient: createFlowError(403, 'INSUFFICIENT_ROLE', 'Only the designated recipient can confirm the transfer.', 'auth'),
      initiator_not_owner: createFlowError(400, 'VALIDATION_ERROR', 'The initiator is no longer the workspace owner.', 'validation'),
      swap_failed: createFlowError(500, 'INTERNAL_ERROR', 'Ownership transfer failed.', 'system'),
    };

    const flowError = errorMap[result.error] ?? createFlowError(500, 'INTERNAL_ERROR', 'Transfer failed.', 'system');
    return { success: false, error: flowError };
  }

  const { fromUserId, toUserId } = result;

  try {
    await invalidateUserSessions(fromUserId);
    await invalidateUserSessions(toUserId);
  } catch {
    // Session invalidation best-effort
  }

  revalidateTag(cacheTag('workspace_member', ctx.workspaceId));

  await logWorkspaceEvent({
    type: 'ownership_transferred',
    workspaceId: ctx.workspaceId,
    fromUserId,
    toUserId,
    timestamp: new Date().toISOString(),
  });

  return { success: true, data: undefined };
}
