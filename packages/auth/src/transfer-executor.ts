import { createServiceClient } from '@flow/db/client';

type TransferErrorCode =
  | 'transfer_not_found'
  | 'not_pending'
  | 'expired'
  | 'not_recipient'
  | 'initiator_not_owner'
  | 'swap_failed';

interface TransferSuccess {
  success: true;
  fromUserId: string;
  toUserId: string;
}

interface TransferFailure {
  success: false;
  error: TransferErrorCode;
}

type TransferResult = TransferSuccess | TransferFailure;

export async function executeOwnershipTransfer(params: {
  transferId: string;
  workspaceId: string;
  confirmingUserId: string;
}): Promise<TransferResult> {
  const serviceClient = createServiceClient();

  const { data: transfer } = await serviceClient
    .from('transfer_requests')
    .select('id, workspace_id, from_user_id, to_user_id, status, expires_at')
    .eq('id', params.transferId)
    .eq('workspace_id', params.workspaceId)
    .single();

  if (!transfer) {
    return { success: false, error: 'transfer_not_found' };
  }

  if (transfer.status !== 'pending') {
    return { success: false, error: 'not_pending' };
  }

  if (new Date(transfer.expires_at) < new Date()) {
    await serviceClient
      .from('transfer_requests')
      .update({ status: 'expired' })
      .eq('id', params.transferId);
    return { success: false, error: 'expired' };
  }

  if (params.confirmingUserId !== transfer.to_user_id) {
    return { success: false, error: 'not_recipient' };
  }

  const { data: initiatorMembership } = await serviceClient
    .from('workspace_members')
    .select('role, status')
    .eq('workspace_id', params.workspaceId)
    .eq('user_id', transfer.from_user_id)
    .eq('status', 'active')
    .single();

  if (!initiatorMembership || initiatorMembership.role !== 'owner') {
    await serviceClient
      .from('transfer_requests')
      .update({ status: 'cancelled' })
      .eq('id', params.transferId);
    return { success: false, error: 'initiator_not_owner' };
  }

  const { error: rpcError } = await serviceClient.rpc('execute_ownership_transfer', {
    p_workspace_id: params.workspaceId,
    p_from_user_id: transfer.from_user_id,
    p_to_user_id: transfer.to_user_id,
    p_transfer_id: params.transferId,
  });

  if (rpcError) {
    return { success: false, error: 'swap_failed' };
  }

  return {
    success: true,
    fromUserId: transfer.from_user_id,
    toUserId: transfer.to_user_id,
  };
}
