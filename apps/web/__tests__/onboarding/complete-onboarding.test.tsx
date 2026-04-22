import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/onboarding/completion',
  useSearchParams: () => new URLSearchParams(),
}));

const mockCompleteOnboarding = vi.fn();
vi.mock(
  '../../app/(onboarding)/onboarding/_actions/complete-onboarding',
  () => ({
    completeOnboarding: () => mockCompleteOnboarding(),
  }),
);

vi.mock(
  '../../app/(onboarding)/onboarding/_lib/storage',
  () => ({
    clearOnboardingProgress: vi.fn(),
  }),
);

import { CompletionStep } from '../../app/(onboarding)/onboarding/_components/steps/completion-step';

describe('CompletionStep', () => {
  beforeEach(() => {
    mockCompleteOnboarding.mockReset();
  });

  afterEach(() => cleanup());

  it('renders "Workspace ready" heading', () => {
    render(<CompletionStep />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Workspace ready');
  });

  it('renders single CTA "Go to Workspace"', () => {
    render(<CompletionStep />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('Go to Workspace');
  });

  it('calls completeOnboarding action on click', async () => {
    mockCompleteOnboarding.mockResolvedValue({ success: true, data: undefined });

    render(<CompletionStep />);
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalledOnce();
    });
  });

  it('displays error on failure', async () => {
    mockCompleteOnboarding.mockResolvedValue({
      success: false,
      error: {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Failed to complete onboarding',
        category: 'system',
      },
    });

    render(<CompletionStep />);
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to complete onboarding');
    });
  });

  it('heading has no exclamation mark', () => {
    render(<CompletionStep />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).not.toMatch(/!/);
  });
});
