import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServiceClient, insertEmail, insertSignal, updateClientInboxSyncStatus, updateClientInboxOAuthState, decryptInboxTokens, encryptInboxTokens, isMessageProcessed } from '@flow/db';
import { GmailProvider } from '../../providers/index.js';
import { startHistoryWorker, handleDrainHistory } from '../history-worker';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
  insertEmail: vi.fn().mockResolvedValue({ error: null }),
  insertSignal: vi.fn().mockResolvedValue({ error: null }),
  updateClientInboxSyncStatus: vi.fn().mockResolvedValue({ data: {}, error: null }),
  updateClientInboxOAuthState: vi.fn().mockResolvedValue({ data: {}, error: null }),
  decryptInboxTokens: vi.fn().mockReturnValue({ accessToken: 'old-token', refreshToken: 'r', expiryDate: Date.now() + 3600000 }),
  encryptInboxTokens: vi.fn().mockReturnValue({ encrypted: 'e', iv: 'i', version: 1 }),
  isMessageProcessed: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../providers/index.js', () => ({
  GmailProvider: vi.fn().mockImplementation(() => ({
    getHistorySince: vi.fn().mockResolvedValue([{ messageId: 'm1', threadId: 't1' }]),
    getMessage: vi.fn().mockResolvedValue({
      gmailMessageId: 'm1',
      gmailThreadId: 't1',
      subject: 'Test',
      fromAddress: 'a@b.com',
      fromName: 'A',
      toAddresses: [],
      ccAddresses: [],
      receivedAt: new Date().toISOString(),
      headers: [],
    }),
    refreshToken: vi.fn().mockResolvedValue({ accessToken: 'new-token', expiryDate: Date.now() + 3600000 }),
  })),
}));

vi.mock('../../orchestrator/pg-boss-producer', () => ({
  PgBossProducer: vi.fn().mockImplementation(() => ({
    submit: vi.fn().mockResolvedValue({ runId: 'run-1', status: 'queued' }),
  })),
}));

describe('history-worker', () => {
  let mockSupabase: any;
  let mockBoss: any;

  beforeEach(() => {
    mockSupabase = {
      channel: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      from: vi.fn(),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);
    mockBoss = {
      send: vi.fn().mockResolvedValue('job-id'),
    } as any;
    (global as any).getBoss = vi.fn().mockResolvedValue(mockBoss);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (global as any).getBoss;
  });

  it('subscribes to raw_pubsub_payloads INSERT events', async () => {
    await startHistoryWorker(mockBoss);

    expect(mockSupabase.channel).toHaveBeenCalledWith('history-worker');
    expect(mockSupabase.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'INSERT',
        schema: 'public',
        table: 'raw_pubsub_payloads',
      }),
      expect.any(Function)
    );
    expect(mockSupabase.subscribe).toHaveBeenCalled();
  });

  describe('handleDrainHistory', () => {
    it('fetches history and stores emails', async () => {
      const mockSingleInbox = vi.fn().mockResolvedValue({
        data: { id: 'inbox-1', workspace_id: 'ws-1', client_id: 'c-1', sync_cursor: '100', oauth_state: {} },
        error: null,
      });
      const mockSinglePayload = vi.fn().mockResolvedValue({
        data: { history_id: '200' },
        error: null,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'client_inboxes') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mockSingleInbox };
        }
        if (table === 'raw_pubsub_payloads') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: mockSinglePayload,
            update: vi.fn().mockReturnThis(),
          };
        }
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      await handleDrainHistory({
        workspace_id: 'ws-1',
        payloadId: 'p-1',
        clientInboxId: 'inbox-1',
      }, mockBoss);

      expect(insertEmail).toHaveBeenCalled();
      expect(updateClientInboxSyncStatus).toHaveBeenCalledWith(
        expect.anything(),
        'inbox-1',
        'ws-1',
        'connected',
        expect.objectContaining({
          syncCursor: '200',
        })
      );
    });
  });
});
