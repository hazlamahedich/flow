import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InboxConnectionCard } from '../inbox-connection-card';

vi.mock('../../actions/inbox/get-inbox-status', () => ({
  getInboxStatus: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 'inbox-1',
        workspaceId: 'ws-1',
        clientId: 'client-1',
        provider: 'gmail',
        emailAddress: 'test@gmail.com',
        accessType: 'direct',
        syncStatus: 'connected',
        syncCursor: null,
        errorMessage: null,
        lastSyncAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ],
  }),
}));

describe('InboxConnectionCard', () => {
  it('shows connected inbox with email address', async () => {
    render(<InboxConnectionCard clientId="client-1" role="owner" />);
    const element = await screen.findByText('test@gmail.com');
    expect(element).toBeDefined();
  });

  it('shows Connected badge for connected inbox', async () => {
    render(<InboxConnectionCard clientId="client-1" role="owner" />);
    const badge = await screen.findByText('Connected');
    expect(badge).toBeDefined();
  });
});
