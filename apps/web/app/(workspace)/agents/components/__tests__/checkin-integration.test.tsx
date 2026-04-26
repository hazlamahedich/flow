import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore } from 'jotai';
import { trustBadgeMapAtom, trustBadgeAnimationAtom, type TrustBadgeData } from '../../../../../../lib/atoms/trust';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('../../actions/checkin-actions', () => ({
  deferCheckIn: vi.fn().mockResolvedValue({ success: true, data: { deferredCount: 1, nextCheckIn: null, pinned: false } }),
  acknowledgeCheckIn: vi.fn().mockResolvedValue({ success: true, data: { reviewedAt: '2025-03-01T00:00:00Z' } }),
}));

vi.mock('@flow/db', () => ({
  getRecentAutoActions: vi.fn().mockResolvedValue([
    { id: 'r1', agentId: 'inbox', actionType: 'general', status: 'completed', createdAt: '2025-02-25T00:00:00Z', summary: null },
  ]),
}));

vi.mock('../../../../lib/hooks/use-trust-announcer', () => ({
  useTrustAnnouncer: () => vi.fn(),
}));

import { TrustCheckInPrompt } from '../trust-checkin-prompt';
import { TrustCheckInReview } from '../trust-checkin-review';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

describe('Check-in integration', () => {
  it('prompt accept opens review mode', async () => {
    const onAccept = vi.fn();
    render(
      <TrustCheckInPrompt
        agentId="inbox"
        agentLabel="Inbox"
        workspaceId="ws-1"
        deferredCount={0}
        isPinned={false}
        onAccept={onAccept}
        onDefer={vi.fn()}
      />,
    );
    await act(async () => { fireEvent.click(screen.getByText('Take a look')); });
    expect(onAccept).toHaveBeenCalled();
  });

  it('max defer shows pinned state (no Remind me later)', () => {
    render(
      <TrustCheckInPrompt
        agentId="inbox"
        agentLabel="Inbox"
        workspaceId="ws-1"
        deferredCount={3}
        isPinned={true}
        onAccept={vi.fn()}
        onDefer={vi.fn()}
      />,
    );
    expect(screen.queryByText('Remind me later')).not.toBeInTheDocument();
  });

  it('review mode displays auto actions', async () => {
    const { getRecentAutoActions } = await import('@flow/db');
    render(
      <TrustCheckInReview
        agentId="inbox"
        agentLabel="Inbox"
        workspaceId="ws-1"
        actions={[
          { id: 'r1', agentId: 'inbox', actionType: 'general', status: 'completed', createdAt: '2025-02-25T00:00:00Z', summary: null },
        ]}
        onAcknowledge={vi.fn().mockResolvedValue({ success: true, data: { reviewedAt: '2025-03-01' } })}
        onAdjust={vi.fn()}
      />,
    );
    expect(screen.getByText(/Recent Inbox actions/)).toBeInTheDocument();
    expect(screen.getByText('general')).toBeInTheDocument();
  });

  it('review empty state shows message', () => {
    render(
      <TrustCheckInReview
        agentId="inbox"
        agentLabel="Inbox"
        workspaceId="ws-1"
        actions={[]}
        onAcknowledge={vi.fn().mockResolvedValue({ success: true, data: { reviewedAt: '2025-03-01' } })}
        onAdjust={vi.fn()}
      />,
    );
    expect(screen.getByText(/No recent actions to review/)).toBeInTheDocument();
  });

  it('error in action shows inline error', async () => {
    const { deferCheckIn } = await import('../../actions/checkin-actions');
    vi.mocked(deferCheckIn).mockResolvedValueOnce({ success: false, error: { message: 'fail' } });

    render(
      <TrustCheckInPrompt
        agentId="inbox"
        agentLabel="Inbox"
        workspaceId="ws-1"
        deferredCount={0}
        isPinned={false}
        onAccept={vi.fn()}
        onDefer={deferCheckIn as never}
      />,
    );
    await act(async () => { fireEvent.click(screen.getByText('Remind me later')); });
    expect(screen.getByText(/Could not snooze/)).toBeInTheDocument();
  });

  it('auto-dismiss fires after 20s', () => {
    const { container } = render(
      <TrustCheckInPrompt
        agentId="inbox"
        agentLabel="Inbox"
        workspaceId="ws-1"
        deferredCount={0}
        isPinned={false}
        onAccept={vi.fn()}
        onDefer={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-testid="checkin-prompt-inbox"]')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(container.querySelector('[data-testid="checkin-prompt-inbox"]')).toBeNull();
  });
});
