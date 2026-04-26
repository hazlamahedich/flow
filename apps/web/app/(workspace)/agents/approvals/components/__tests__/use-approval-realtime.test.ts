import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(() => ({})),
      })),
    })),
    removeChannel: vi.fn(),
  })),
}));

describe('useApprovalRealtime', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('can be imported without error', async () => {
    const { useApprovalRealtime } = await import('../use-approval-realtime');
    expect(typeof useApprovalRealtime).toBe('function');
  });

  it('creates a browser client on mount', async () => {
    const { useApprovalRealtime } = await import('../use-approval-realtime');
    const { result } = renderHook(() => useApprovalRealtime({
      workspaceId: 'ws-1',
      onNewItem: vi.fn(),
    }));
    const { createBrowserClient } = await import('@supabase/ssr');
    expect(createBrowserClient).toHaveBeenCalled();
  });
});
