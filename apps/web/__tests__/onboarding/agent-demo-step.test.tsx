import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/onboarding/agent-demo',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@flow/ui', async (importOriginal) => {
  const original = await importOriginal<typeof import('@flow/ui')>();
  return {
    ...original,
    useReducedMotion: () => false,
  };
});

import { AgentDemoStep } from '../../app/(onboarding)/onboarding/_components/steps/agent-demo-step';

describe('AgentDemoStep', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders "Your Day, Organized" header', () => {
    render(<AgentDemoStep demoDelayMs={0} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your Day, Organized');
  });

  it('renders Marcus scenario', () => {
    render(<AgentDemoStep demoDelayMs={0} />);
    expect(screen.getByText(/coaching client/)).toBeInTheDocument();
    expect(screen.getAllByText(/Marcus/).length).toBeGreaterThan(0);
  });

  it('renders imperfection placeholder', () => {
    render(<AgentDemoStep demoDelayMs={0} />);
    expect(screen.getByText('[confirm meeting time]')).toBeInTheDocument();
  });

  it('tooltip is keyboard accessible', async () => {
    render(<AgentDemoStep demoDelayMs={0} />);
    const trigger = screen.getByText('[confirm meeting time]');
    expect(trigger).toHaveAttribute('aria-describedby', 'imperfection-tooltip');

    await userEvent.click(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Tap to personalize/);
  });

  it('renders immediately with demoDelayMs={0}', () => {
    render(<AgentDemoStep demoDelayMs={0} />);
    expect(screen.getByText(/Inbox Agent detected/)).toBeInTheDocument();
  });

  it('shows draft after delay', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<AgentDemoStep demoDelayMs={1500} />);
    expect(screen.queryByText(/Inbox Agent detected/)).not.toBeInTheDocument();

    vi.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(screen.getByText(/Inbox Agent detected/)).toBeInTheDocument();
    });
  });

  it('renders delight hook', () => {
    render(<AgentDemoStep demoDelayMs={0} />);
    expect(screen.getByText(/In your first week/)).toBeInTheDocument();
  });

  it('renders honest framing', () => {
    render(<AgentDemoStep demoDelayMs={0} />);
    expect(screen.getByText(/Your Inbox Agent is learning how you write/)).toBeInTheDocument();
  });

  it('renders sample agent draft label', () => {
    render(<AgentDemoStep demoDelayMs={0} />);
    expect(screen.getByText('Sample Agent Draft — your real drafts will learn your voice')).toBeInTheDocument();
  });

  it('renders Continue CTA', () => {
    render(<AgentDemoStep demoDelayMs={0} />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });
});
