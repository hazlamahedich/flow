import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CeremonyStepStats, CeremonyStepAcknowledge, CeremonyStepConfirm } from '../trust-ceremony-steps';

describe('CeremonyStepStats', () => {
  afterEach(() => cleanup());

  it('renders stats text', () => {
    render(<CeremonyStepStats cleanApprovals={10} totalRuns={50} daysAtLevel={30} />);
    expect(screen.getByText(/10/)).toBeDefined();
  });
});

describe('CeremonyStepAcknowledge', () => {
  afterEach(() => cleanup());

  it('renders agent label in heading', () => {
    render(<CeremonyStepAcknowledge agentLabel="Inbox" actionLabel="categorize emails" escapeInstruction="Press Esc to skip" />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Inbox');
  });

  it('renders escape instruction as sr-only', () => {
    render(<CeremonyStepAcknowledge agentLabel="Inbox" actionLabel="categorize emails" escapeInstruction="Press Esc to skip" />);
    const srOnly = screen.getByText('Press Esc to skip');
    expect(srOnly.className).toContain('sr-only');
  });
});

describe('CeremonyStepConfirm', () => {
  afterEach(() => cleanup());

  it('renders accept, decline, and remind later buttons', () => {
    render(<CeremonyStepConfirm onAccept={vi.fn()} onDecline={vi.fn()} onRemindLater={vi.fn()} declineRef={{ current: null }} />);
    expect(screen.getByText('Accept')).toBeDefined();
    expect(screen.getByText('Not yet')).toBeDefined();
    expect(screen.getByText('Remind me later')).toBeDefined();
  });

  it('disables buttons when loading', () => {
    render(<CeremonyStepConfirm onAccept={vi.fn()} onDecline={vi.fn()} onRemindLater={vi.fn()} declineRef={{ current: null }} loading={true} />);
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn).toHaveProperty('disabled', true);
    }
  });

  it('shows Saving text when loading', () => {
    render(<CeremonyStepConfirm onAccept={vi.fn()} onDecline={vi.fn()} onRemindLater={vi.fn()} declineRef={{ current: null }} loading={true} />);
    expect(screen.getByText(/Saving/)).toBeDefined();
  });

  it('calls onAccept when accept clicked', async () => {
    const onAccept = vi.fn();
    render(<CeremonyStepConfirm onAccept={onAccept} onDecline={vi.fn()} onRemindLater={vi.fn()} declineRef={{ current: null }} />);
    await userEvent.click(screen.getByText('Accept'));
    expect(onAccept).toHaveBeenCalledOnce();
  });
});
