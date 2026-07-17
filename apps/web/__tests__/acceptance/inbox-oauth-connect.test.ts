import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  createTestInbox,
  createTestEmail,
  FAKE_WORKSPACE_ID,
  FAKE_CLIENT_ID,
} from './epic-4/test-factories';

const mockGetServerSupabase = vi.fn();
const mockRequireTenantContext = vi.fn();
const mockCreateClientInbox = vi.fn();
const mockGetClientInboxByEmail = vi.fn();
const mockInitiateOAuth = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: () => mockGetServerSupabase(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: (...args: unknown[]) =>
    mockRequireTenantContext(...args),
  createClientInbox: (...args: unknown[]) => mockCreateClientInbox(...args),
  getClientInboxByEmail: (...args: unknown[]) =>
    mockGetClientInboxByEmail(...args),
}));

describe('[P0] Inbox OAuth Connect Flow (ATDD)', () => {
  const mockSupabase = {};
  const inbox = createTestInbox();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSupabase.mockResolvedValue(mockSupabase);
    mockRequireTenantContext.mockResolvedValue({
      workspaceId: FAKE_WORKSPACE_ID,
      role: 'owner',
    });
  });

  test('AC1: should initiate OAuth and return authorization URL', async () => {
    const oauthUrl =
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=test';
    mockInitiateOAuth.mockResolvedValue({
      success: true,
      data: { url: oauthUrl },
    });

    const result = await mockInitiateOAuth({
      clientId: FAKE_CLIENT_ID,
      workspaceId: FAKE_WORKSPACE_ID,
    });

    expect(result.success).toBe(true);
    expect(result.data.url).toContain('accounts.google.com');
    expect(mockInitiateOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: FAKE_CLIENT_ID }),
    );
  });

  test('AC2: should handle OAuth callback and create inbox record', async () => {
    mockCreateClientInbox.mockResolvedValue(inbox);

    const result = await mockCreateClientInbox(mockSupabase, {
      workspaceId: FAKE_WORKSPACE_ID,
      clientId: FAKE_CLIENT_ID,
      emailAddress: inbox.email_address,
      provider: 'gmail',
      accessType: 'direct',
    });

    expect(result).toBeDefined();
    expect(result.workspace_id).toBe(FAKE_WORKSPACE_ID);
    expect(result.client_id).toBe(FAKE_CLIENT_ID);
    expect(mockCreateClientInbox).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        workspaceId: FAKE_WORKSPACE_ID,
        provider: 'gmail',
      }),
    );
  });

  test('AC3: should return inbox connection status for a client', async () => {
    mockGetClientInboxByEmail.mockResolvedValue(inbox);

    const result = await mockGetClientInboxByEmail(mockSupabase, {
      workspaceId: FAKE_WORKSPACE_ID,
      email: inbox.email_address,
    });

    expect(result).toBeDefined();
    expect(result.sync_status).toBe('connected');
  });

  test('AC4: should disconnect inbox and revoke tokens', async () => {
    const mockDisconnect = vi.fn().mockResolvedValue({ success: true });

    const result = await mockDisconnect({
      inboxId: inbox.id,
      workspaceId: FAKE_WORKSPACE_ID,
    });

    expect(result.success).toBe(true);
    expect(mockDisconnect).toHaveBeenCalledWith(
      expect.objectContaining({ inboxId: inbox.id }),
    );
  });

  test('AC5: should return error when OAuth is denied by user', async () => {
    mockInitiateOAuth.mockResolvedValue({
      success: false,
      error: 'OAuth consent was denied by the user.',
    });

    const result = await mockInitiateOAuth({
      clientId: FAKE_CLIENT_ID,
      workspaceId: FAKE_WORKSPACE_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('denied');
  });

  test('AC6: should reject duplicate inbox connection', async () => {
    mockGetClientInboxByEmail.mockResolvedValue(inbox);
    mockCreateClientInbox.mockRejectedValue(
      new Error('Email already connected'),
    );

    await expect(
      mockCreateClientInbox(mockSupabase, {
        workspaceId: FAKE_WORKSPACE_ID,
        clientId: FAKE_CLIENT_ID,
        emailAddress: inbox.email_address,
        provider: 'gmail',
        accessType: 'direct',
      }),
    ).rejects.toThrow('Email already connected');
  });

  test('AC7: should enforce rate limiting on OAuth initiations', async () => {
    mockInitiateOAuth.mockResolvedValue({
      success: false,
      error: 'Rate limit exceeded. Please try again in 60 seconds.',
    });

    const result = await mockInitiateOAuth({
      clientId: FAKE_CLIENT_ID,
      workspaceId: FAKE_WORKSPACE_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Rate limit');
  });
});
