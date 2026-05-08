import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeInitialSync } from '../initial-sync';

const mockGetProfile = vi.fn().mockResolvedValue({ historyId: '99999' });
const mockListMessages = vi.fn().mockResolvedValue([]);
const mockRefreshToken = vi.fn();
const mockWatchInbox = vi.fn();

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@flow/db/vault/inbox-tokens', () => ({
  decryptInboxTokens: vi.fn(),
  encryptInboxTokens: vi.fn(),
}));

vi.mock('../../providers/index.js', () => ({
  GmailProvider: vi.fn().mockImplementation(() => ({
    refreshToken: mockRefreshToken,
    listMessages: mockListMessages,
    getMessageMetadata: vi.fn(),
    getProfile: mockGetProfile,
    watchInbox: mockWatchInbox,
  })),
}));

import { createServiceClient } from '@flow/db';
import { decryptInboxTokens, encryptInboxTokens } from '@flow/db/vault/inbox-tokens';

const mockSupabase: any = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  update: vi.fn().mockReturnThis(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (createServiceClient as any).mockReturnValue(mockSupabase);
  mockSupabase.from.mockReturnThis();
  mockSupabase.select.mockReturnThis();
  mockSupabase.eq.mockReturnThis();
  mockSupabase.update.mockReturnThis();
  mockGetProfile.mockResolvedValue({ historyId: '99999' });
  mockListMessages.mockResolvedValue([]);
  mockWatchInbox.mockResolvedValue(undefined);
});

describe('executeInitialSync', () => {
  const input = {
    clientInboxId: '00000000-0000-0000-0000-000000000001',
    historyId: '12345',
  };

  const connectedInbox = {
    id: input.clientInboxId,
    workspace_id: '00000000-0000-0000-0000-000000000002',
    client_id: '00000000-0000-0000-0000-000000000003',
    provider: 'gmail',
    email_address: 'test@gmail.com',
    access_type: 'direct',
    oauth_state: { encrypted: 'enc', iv: 'iv', version: 1 },
    sync_status: 'connected',
    sync_cursor: null,
    error_message: null,
    last_sync_at: null,
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('returns early when inbox not found', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

    await executeInitialSync(input);

    expect(mockSupabase.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ sync_status: 'syncing' }),
    );
  });

  it('returns early when inbox is disconnected', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: { ...connectedInbox, sync_status: 'disconnected' },
      error: null,
    });

    await executeInitialSync(input);

    expect(mockSupabase.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ sync_status: 'syncing' }),
    );
  });

  it('sets sync_status to error when token decryption fails', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: connectedInbox, error: null });
    (decryptInboxTokens as any).mockImplementation(() => {
      throw new Error('Decryption failed');
    });

    await executeInitialSync(input);

    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ sync_status: 'error', error_message: 'Token decryption failed' }),
    );
  });

  it('sets sync_status to connected on successful sync', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: connectedInbox, error: null });
    (decryptInboxTokens as any).mockReturnValue({
      accessToken: 'at',
      refreshToken: 'rt',
      expiryDate: Date.now() + 100000,
    });

    await executeInitialSync(input);

    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ sync_status: 'syncing' }),
    );
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ sync_status: 'connected' }),
    );
  });

  it('sets sync_status to error when sync throws', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: connectedInbox, error: null });
    (decryptInboxTokens as any).mockReturnValue({
      accessToken: 'at',
      refreshToken: 'rt',
      expiryDate: Date.now() + 100000,
    });
    mockListMessages.mockRejectedValue(new Error('Gmail API down'));

    await executeInitialSync(input);

    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ sync_status: 'error', error_message: 'Gmail API down' }),
    );
  });

  it('refreshes token when expired', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: connectedInbox, error: null });
    (decryptInboxTokens as any).mockReturnValue({
      accessToken: 'at',
      refreshToken: 'rt',
      expiryDate: Date.now() - 1000,
    });
    mockRefreshToken.mockResolvedValue({ accessToken: 'new-at', refreshToken: 'new-rt', expiryDate: Date.now() + 3600000 });
    (encryptInboxTokens as any).mockReturnValue({ encrypted: 'new', iv: 'new', version: 1 });

    await executeInitialSync(input);

    expect(mockRefreshToken).toHaveBeenCalledWith('rt');
    expect(encryptInboxTokens).toHaveBeenCalled();
  });
});
