import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

function mockSupabase(returnData: unknown, returnError: unknown = null): SupabaseClient {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
    single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
    order: vi.fn().mockReturnThis(),
  };
  const from = vi.fn().mockReturnValue(chain);
  return { from } as unknown as SupabaseClient;
}

import {
  getClientInboxById,
  getClientInboxByEmail,
  updateClientInboxSyncStatus,
  clearClientInboxTokens,
} from '../crud';

describe('inbox CRUD queries', () => {
  const mockInbox = {
    id: 'inbox-1',
    workspace_id: 'ws-1',
    client_id: 'client-1',
    provider: 'gmail',
    email_address: 'test@gmail.com',
    access_type: 'direct' as const,
    oauth_state: {},
    sync_status: 'connected' as const,
    sync_cursor: null,
    error_message: null,
    last_sync_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  describe('getClientInboxById', () => {
    it('returns mapped inbox when found', async () => {
      const supabase = mockSupabase(mockInbox);
      const result = await getClientInboxById(supabase, 'inbox-1', 'ws-1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('inbox-1');
      expect(result?.emailAddress).toBe('test@gmail.com');
    });

    it('returns null when not found', async () => {
      const supabase = mockSupabase(null);
      const result = await getClientInboxById(supabase, 'nonexistent', 'ws-1');
      expect(result).toBeNull();
    });
  });

  describe('getClientInboxByEmail', () => {
    it('returns inbox when found', async () => {
      const supabase = mockSupabase(mockInbox);
      const result = await getClientInboxByEmail(supabase, 'ws-1', 'test@gmail.com');
      expect(result?.emailAddress).toBe('test@gmail.com');
    });
  });

  describe('updateClientInboxSyncStatus', () => {
    it('updates sync status and extras', async () => {
      const supabase = mockSupabase({ ...mockInbox, sync_status: 'syncing' });
      const result = await updateClientInboxSyncStatus(supabase, 'inbox-1', 'ws-1', 'syncing', {
        syncCursor: '500',
      });
      expect(result?.syncStatus).toBe('syncing');
    });
  });

  describe('clearClientInboxTokens', () => {
    it('clears oauth state and sets disconnected', async () => {
      const supabase = mockSupabase({ ...mockInbox, sync_status: 'disconnected', oauth_state: {} });
      const result = await clearClientInboxTokens(supabase, 'inbox-1', 'ws-1');
      expect(result?.syncStatus).toBe('disconnected');
    });
  });
});
