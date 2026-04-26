import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { mockMatchMedia } from './helpers/match-media-mock';

mockMatchMedia();

const mockDefer = vi.fn();
const mockAccept = vi.fn();

vi.mock('../../actions/checkin-actions', () => ({
  deferCheckIn: () => mockDefer(),
  acknowledgeCheckIn: vi.fn(),
}));

import { TrustCheckInPrompt } from '../trust-checkin-prompt';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('TrustCheckInPrompt', () => {
  const defaultProps = {
    agentId: 'inbox',
    agentLabel: 'Inbox Agent',
    workspaceId: 'ws-1',
    deferredCount: 0,
    isPinned: false,
    onAccept: mockAccept,
    onDefer: mockDefer,
  };

  it('renders for auto agent with check-in due', () => {
    render(<TrustCheckInPrompt {...defaultProps} />);
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(screen.getByText(/Inbox Agent/)).toBeInTheDocument();
  });

  it('shows Take a look and Remind me later buttons', () => {
    render(<TrustCheckInPrompt {...defaultProps} />);
    expect(screen.getByText('Take a look')).toBeInTheDocument();
    expect(screen.getByText('Remind me later')).toBeInTheDocument();
  });

  it('hides Remind me later when pinned (max deferrals)', () => {
    render(<TrustCheckInPrompt {...defaultProps} isPinned={true} deferredCount={3} />);
    expect(screen.getByText('Take a look')).toBeInTheDocument();
    expect(screen.queryByText('Remind me later')).not.toBeInTheDocument();
  });

  it('calls onAccept when Take a look clicked', () => {
    render(<TrustCheckInPrompt {...defaultProps} />);
    fireEvent.click(screen.getByText('Take a look'));
    expect(mockAccept).toHaveBeenCalled();
  });

  it('has role="complementary" with aria-label', () => {
    render(<TrustCheckInPrompt {...defaultProps} />);
    const el = screen.getByRole('complementary');
    expect(el).toHaveAttribute('aria-label', 'Trust check-in for Inbox Agent');
  });

  it('auto-dismisses after 20 seconds', () => {
    const { container } = render(<TrustCheckInPrompt {...defaultProps} />);
    expect(container.querySelector('[data-testid="checkin-prompt-inbox"]')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(container.querySelector('[data-testid="checkin-prompt-inbox"]')).toBeNull();
  });

  it('shows error state when defer fails', async () => {
    mockDefer.mockResolvedValueOnce({ success: false, error: { message: 'fail' } });
    render(<TrustCheckInPrompt {...defaultProps} />);
    await act(async () => { fireEvent.click(screen.getByText('Remind me later')); });
    expect(screen.getByText('Could not snooze. Please try again.')).toBeInTheDocument();
  });

  it('keyboard tab between buttons', () => {
    render(<TrustCheckInPrompt {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
