import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectInboxDialog } from '../connect-inbox-dialog';

vi.mock('../../actions/inbox/initiate-oauth', () => ({
  initiateOAuth: vi.fn().mockResolvedValue({
    success: false,
    error: { status: 500, code: 'INTERNAL_ERROR', message: 'Test error', category: 'system' },
  }),
}));

describe('ConnectInboxDialog', () => {
  it('renders dialog with access type options', () => {
    render(
      <ConnectInboxDialog
        clientId="client-1"
        existingInbox={null}
        onClose={() => {}}
        onConnected={() => {}}
      />,
    );
    expect(screen.getByText('Connect Gmail Inbox')).toBeDefined();
    expect(screen.getByText('Direct access')).toBeDefined();
    expect(screen.getByText('Delegated access')).toBeDefined();
  });

  it('shows cancel button', () => {
    render(
      <ConnectInboxDialog
        clientId="client-1"
        existingInbox={null}
        onClose={() => {}}
        onConnected={() => {}}
      />,
    );
    const buttons = screen.getAllByText('Cancel');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});
