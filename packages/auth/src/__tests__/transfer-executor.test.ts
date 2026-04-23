import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeOwnershipTransfer } from '../transfer-executor';

vi.mock('@flow/db/client', () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from '@flow/db/client';

function generateId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function makeBaseParams() {
  const fromUserId = generateId('user');
  const toUserId = generateId('user');
  const transferId = generateId('transfer');
  const workspaceId = generateId('ws');
  return {
    params: {
      transferId,
      workspaceId,
      confirmingUserId: toUserId,
    },
    transfer: {
      id: transferId,
      workspace_id: workspaceId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      status: 'pending' as const,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    },
  };
}

function setupServiceClient(tables: Record<string, Record<string, unknown>> = {}) {
  const client = {
    from: vi.fn((table: string) => {
      const t = tables[table] ?? {};
      const selectSingle = t.selectSingle ?? { data: null, error: null };
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => selectSingle),
              })),
              single: vi.fn(() => selectSingle),
            })),
            single: vi.fn(() => selectSingle),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    }),
    rpc: vi.fn(() => tables.rpc ?? { error: null }),
  };

  vi.mocked(createServiceClient).mockReturnValue(client as unknown as ReturnType<typeof createServiceClient>);
  return client;
}

describe('executeOwnershipTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P0] returns transfer_not_found when no transfer record', async () => {
    const { params } = makeBaseParams();
    setupServiceClient({
      transfer_requests: {
        selectSingle: { data: null, error: null },
      },
    });

    const result = await executeOwnershipTransfer(params);
    expect(result).toEqual({ success: false, error: 'transfer_not_found' });
  });

  it('[P0] returns not_pending when status is not pending', async () => {
    const { params, transfer } = makeBaseParams();
    setupServiceClient({
      transfer_requests: {
        selectSingle: { data: { ...transfer, status: 'accepted' }, error: null },
      },
    });

    const result = await executeOwnershipTransfer(params);
    expect(result).toEqual({ success: false, error: 'not_pending' });
  });

  it('[P0] returns expired and updates status when past expiry', async () => {
    const { params, transfer } = makeBaseParams();
    setupServiceClient({
      transfer_requests: {
        selectSingle: {
          data: { ...transfer, expires_at: new Date(Date.now() - 1000).toISOString() },
          error: null,
        },
      },
    });

    const result = await executeOwnershipTransfer(params);
    expect(result).toEqual({ success: false, error: 'expired' });
  });

  it('[P0] returns not_recipient when confirming user is not to_user_id', async () => {
    const { params, transfer } = makeBaseParams();
    setupServiceClient({
      transfer_requests: {
        selectSingle: { data: transfer, error: null },
      },
    });

    const result = await executeOwnershipTransfer({
      ...params,
      confirmingUserId: generateId('user'),
    });
    expect(result).toEqual({ success: false, error: 'not_recipient' });
  });

  it('[P0] returns initiator_not_owner and cancels when initiator lost owner role', async () => {
    const { params, transfer } = makeBaseParams();
    setupServiceClient({
      transfer_requests: {
        selectSingle: { data: transfer, error: null },
      },
      workspace_members: {
        selectSingle: { data: { role: 'admin', status: 'active' }, error: null },
      },
    });

    const result = await executeOwnershipTransfer(params);
    expect(result).toEqual({ success: false, error: 'initiator_not_owner' });
  });

  it('[P0] returns initiator_not_owner when initiator membership is missing', async () => {
    const { params, transfer } = makeBaseParams();
    setupServiceClient({
      transfer_requests: {
        selectSingle: { data: transfer, error: null },
      },
      workspace_members: {
        selectSingle: { data: null, error: null },
      },
    });

    const result = await executeOwnershipTransfer(params);
    expect(result).toEqual({ success: false, error: 'initiator_not_owner' });
  });

  it('[P0] returns swap_failed when RPC call errors', async () => {
    const { params, transfer } = makeBaseParams();
    setupServiceClient({
      transfer_requests: {
        selectSingle: { data: transfer, error: null },
      },
      workspace_members: {
        selectSingle: { data: { role: 'owner', status: 'active' }, error: null },
      },
      rpc: { error: { message: 'RPC failed' } },
    });

    const result = await executeOwnershipTransfer(params);
    expect(result).toEqual({ success: false, error: 'swap_failed' });
  });

  it('[P0] returns success with user IDs on valid transfer', async () => {
    const { params, transfer } = makeBaseParams();
    setupServiceClient({
      transfer_requests: {
        selectSingle: { data: transfer, error: null },
      },
      workspace_members: {
        selectSingle: { data: { role: 'owner', status: 'active' }, error: null },
      },
      rpc: { error: null },
    });

    const result = await executeOwnershipTransfer(params);
    expect(result).toEqual({
      success: true,
      fromUserId: transfer.from_user_id,
      toUserId: transfer.to_user_id,
    });
  });
});
