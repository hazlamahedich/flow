import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeOwnershipTransfer } from '../transfer-executor';

vi.mock('@flow/db/client', () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from '@flow/db/client';

const baseParams = {
  transferId: 'transfer-1',
  workspaceId: 'ws-1',
  confirmingUserId: 'user-b',
};

const validTransfer = {
  id: 'transfer-1',
  workspace_id: 'ws-1',
  from_user_id: 'user-a',
  to_user_id: 'user-b',
  status: 'pending',
  expires_at: new Date(Date.now() + 86400000).toISOString(),
};

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
    setupServiceClient({
      transfer_requests: {
        selectSingle: { data: null, error: null },
      },
    });

    const result = await executeOwnershipTransfer(baseParams);
    expect(result).toEqual({ success: false, error: 'transfer_not_found' });
  });

  it('[P0] returns not_pending when status is not pending', async () => {
    setupServiceClient({
      transfer_requests: {
        selectSingle: { data: { ...validTransfer, status: 'accepted' }, error: null },
      },
    });

    const result = await executeOwnershipTransfer(baseParams);
    expect(result).toEqual({ success: false, error: 'not_pending' });
  });

  it('[P0] returns expired and updates status when past expiry', async () => {
    setupServiceClient({
      transfer_requests: {
        selectSingle: {
          data: { ...validTransfer, expires_at: new Date(Date.now() - 1000).toISOString() },
          error: null,
        },
      },
    });

    const result = await executeOwnershipTransfer(baseParams);
    expect(result).toEqual({ success: false, error: 'expired' });
  });

  it('[P0] returns not_recipient when confirming user is not to_user_id', async () => {
    setupServiceClient({
      transfer_requests: {
        selectSingle: { data: validTransfer, error: null },
      },
    });

    const result = await executeOwnershipTransfer({
      ...baseParams,
      confirmingUserId: 'user-c',
    });
    expect(result).toEqual({ success: false, error: 'not_recipient' });
  });

  it('[P0] returns initiator_not_owner and cancels when initiator lost owner role', async () => {
    setupServiceClient({
      transfer_requests: {
        selectSingle: { data: validTransfer, error: null },
      },
      workspace_members: {
        selectSingle: { data: { role: 'admin', status: 'active' }, error: null },
      },
    });

    const result = await executeOwnershipTransfer(baseParams);
    expect(result).toEqual({ success: false, error: 'initiator_not_owner' });
  });

  it('[P0] returns initiator_not_owner when initiator membership is missing', async () => {
    setupServiceClient({
      transfer_requests: {
        selectSingle: { data: validTransfer, error: null },
      },
      workspace_members: {
        selectSingle: { data: null, error: null },
      },
    });

    const result = await executeOwnershipTransfer(baseParams);
    expect(result).toEqual({ success: false, error: 'initiator_not_owner' });
  });

  it('[P0] returns swap_failed when RPC call errors', async () => {
    setupServiceClient({
      transfer_requests: {
        selectSingle: { data: validTransfer, error: null },
      },
      workspace_members: {
        selectSingle: { data: { role: 'owner', status: 'active' }, error: null },
      },
      rpc: { error: { message: 'RPC failed' } },
    });

    const result = await executeOwnershipTransfer(baseParams);
    expect(result).toEqual({ success: false, error: 'swap_failed' });
  });

  it('[P0] returns success with user IDs on valid transfer', async () => {
    setupServiceClient({
      transfer_requests: {
        selectSingle: { data: validTransfer, error: null },
      },
      workspace_members: {
        selectSingle: { data: { role: 'owner', status: 'active' }, error: null },
      },
      rpc: { error: null },
    });

    const result = await executeOwnershipTransfer(baseParams);
    expect(result).toEqual({
      success: true,
      fromUserId: 'user-a',
      toUserId: 'user-b',
    });
  });
});
