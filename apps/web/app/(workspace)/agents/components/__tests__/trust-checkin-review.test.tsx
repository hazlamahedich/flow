import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrustCheckInReview } from '../trust-checkin-review';

function buildAction(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'action-1',
    agentId: overrides.agentId ?? 'inbox',
    actionType: overrides.actionType ?? 'categorize-email',
    createdAt: overrides.createdAt ?? new Date('2026-01-15T12:00:00Z').toISOString(),
    ...overrides,
  } as any;
}

describe('TrustCheckInReview', () => {
  afterEach(() => cleanup());

  it('renders agent label in heading', () => {
    render(<TrustCheckInReview agentId="inbox" agentLabel="Inbox" workspaceId="ws-1" actions={[]} onAcknowledge={vi.fn()} onAdjust={vi.fn()} />);
    expect(screen.getByText(/Inbox/)).toBeDefined();
  });

  it('renders empty state when no actions', () => {
    render(<TrustCheckInReview agentId="inbox" agentLabel="Inbox" workspaceId="ws-1" actions={[]} onAcknowledge={vi.fn()} onAdjust={vi.fn()} />);
    expect(screen.getByTestId('checkin-review-inbox')).toBeDefined();
  });

  it('renders action list when actions provided', () => {
    const actions = [buildAction({ actionType: 'categorize-email' }), buildAction({ id: 'a-2', actionType: 'detect-conflict' })];
    render(<TrustCheckInReview agentId="inbox" agentLabel="Inbox" workspaceId="ws-1" actions={actions} onAcknowledge={vi.fn()} onAdjust={vi.fn()} />);
    expect(screen.getByText('categorize-email')).toBeDefined();
    expect(screen.getByText('detect-conflict')).toBeDefined();
  });

  it('calls onAcknowledge when accept clicked', async () => {
    const onAcknowledge = vi.fn().mockResolvedValue({ success: true, data: { reviewedAt: '2026-01-15' } });
    render(<TrustCheckInReview agentId="inbox" agentLabel="Inbox" workspaceId="ws-1" actions={[]} onAcknowledge={onAcknowledge} onAdjust={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /all good/i }));
    expect(onAcknowledge).toHaveBeenCalledOnce();
  });

  it('calls onAdjust when adjust clicked', async () => {
    const onAdjust = vi.fn();
    render(<TrustCheckInReview agentId="inbox" agentLabel="Inbox" workspaceId="ws-1" actions={[]} onAcknowledge={vi.fn()} onAdjust={onAdjust} />);
    await userEvent.click(screen.getByRole('button', { name: /adjust/i }));
    expect(onAdjust).toHaveBeenCalledWith('inbox');
  });

  it('shows error when onAcknowledge fails', async () => {
    const onAcknowledge = vi.fn().mockResolvedValue({ success: false, error: { status: 500 } });
    render(<TrustCheckInReview agentId="inbox" agentLabel="Inbox" workspaceId="ws-1" actions={[]} onAcknowledge={onAcknowledge} onAdjust={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /all good/i }));
    expect(await screen.findByRole('alert')).toBeDefined();
  });
});
