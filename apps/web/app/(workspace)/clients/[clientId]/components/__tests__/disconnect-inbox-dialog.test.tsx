import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DisconnectInboxDialog } from '../disconnect-inbox-dialog';
import type { ClientInbox } from '@flow/types';

vi.mock('../../actions/inbox/disconnect-inbox', () => ({
  disconnectInbox: vi.fn().mockResolvedValue({
    success: true,
    data: { success: true },
  }),
}));

const mockInbox: ClientInbox = {
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
};

describe('DisconnectInboxDialog', () => {
  it('renders confirmation dialog', () => {
    render(
      <DisconnectInboxDialog
        inbox={mockInbox}
        clientId="client-1"
        onClose={() => {}}
        onDisconnected={() => {}}
      />,
    );
    expect(screen.getByText('Disconnect Inbox')).toBeDefined();
    expect(screen.getByText('test@gmail.com')).toBeDefined();
  });

  it('shows Disconnect button', () => {
    render(
      <DisconnectInboxDialog
        inbox={mockInbox}
        clientId="client-1"
        onClose={() => {}}
        onDisconnected={() => {}}
      />,
    );
    const buttons = screen.getAllByText('Disconnect');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});
