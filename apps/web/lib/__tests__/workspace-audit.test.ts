import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

import { getServerSupabase } from '@/lib/supabase-server';
import { logWorkspaceEvent } from '../workspace-audit';

describe('logWorkspaceEvent', () => {
  let mockInsert: ReturnType<typeof vi.fn>;
  let mockFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    vi.mocked(getServerSupabase).mockResolvedValue({
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof getServerSupabase>>);
  });

  it('inserts correct fields into audit_log', async () => {
    const event = { type: 'workspace.created', workspaceId: 'ws-1' } as any;
    await logWorkspaceEvent(event);
    expect(mockFrom).toHaveBeenCalledWith('audit_log');
    expect(mockInsert).toHaveBeenCalledWith({
      workspace_id: 'ws-1',
      action: 'workspace.created',
      entity_type: 'workspace',
      details: event,
    });
  });

  it('sets workspace_id from event when present', async () => {
    const event = { type: 'workspace.updated', workspaceId: 'ws-42' } as any;
    await logWorkspaceEvent(event);
    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted.workspace_id).toBe('ws-42');
  });

  it('sets workspace_id to null when not in event', async () => {
    const event = { type: 'workspace.deleted' } as any;
    await logWorkspaceEvent(event);
    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted.workspace_id).toBeNull();
  });

  it('sets entity_type to workspace', async () => {
    const event = { type: 'workspace.created', workspaceId: 'ws-1' } as any;
    await logWorkspaceEvent(event);
    const inserted = mockInsert.mock.calls[0][0];
    expect(inserted.entity_type).toBe('workspace');
  });

  it('does not throw when supabase fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInsert.mockRejectedValue(new Error('db down'));
    const event = { type: 'workspace.created', workspaceId: 'ws-1' } as any;
    await expect(logWorkspaceEvent(event)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to log workspace event:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});
