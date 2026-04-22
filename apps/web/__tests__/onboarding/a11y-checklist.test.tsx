import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/onboarding/agent-demo',
  useSearchParams: () =>
    new URLSearchParams('clientId=cl-1&clientName=Test'),
}));

vi.mock('@flow/ui', async (importOriginal) => {
  const original = await importOriginal<typeof import('@flow/ui')>();
  return {
    ...original,
    useReducedMotion: () => false,
    useFocusTrap: () => ({ ref: vi.fn() }),
  };
});

import { StepIndicator } from '../../app/(onboarding)/onboarding/_components/step-indicator';
import { AgentDemoStep } from '../../app/(onboarding)/onboarding/_components/steps/agent-demo-step';
import { WelcomeStep } from '../../app/(onboarding)/onboarding/_components/steps/welcome-step';
import { CompletionStep } from '../../app/(onboarding)/onboarding/_components/steps/completion-step';

describe('TC-1.10-A11Y Accessibility Checklist', () => {
  afterEach(() => cleanup());

  it('TC-1.10-A11Y-01: step indicator has aria-current="step"', () => {
    render(<StepIndicator currentStep="agent-demo" />);
    const current = screen.getByLabelText('Step 2 of 4: Agent Demo');
    expect(current).toHaveAttribute('aria-current', 'step');
  });

  it('TC-1.10-A11Y-02: step indicator has aria-label for each step', () => {
    render(<StepIndicator currentStep="welcome" />);
    expect(screen.getByLabelText('Step 1 of 4: Welcome')).toBeInTheDocument();
    expect(screen.getByLabelText('Step 2 of 4: Agent Demo')).toBeInTheDocument();
    expect(screen.getByLabelText('Step 3 of 4: Create Client')).toBeInTheDocument();
    expect(screen.getByLabelText('Step 4 of 4: Log Time')).toBeInTheDocument();
  });

  it('TC-1.10-A11Y-03: nav has aria-label', () => {
    render(<StepIndicator currentStep="welcome" />);
    expect(screen.getByRole('navigation', { name: 'Onboarding progress' })).toBeInTheDocument();
  });

  it('TC-1.10-A11Y-06: tooltip is keyboard accessible', async () => {
    render(<AgentDemoStep demoDelayMs={0} />);
    const trigger = screen.getByText('[confirm meeting time]');

    await userEvent.click(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('TC-1.10-A11Y-07: tooltip dismisses on blur', async () => {
    render(<AgentDemoStep demoDelayMs={0} />);
    const trigger = screen.getByText('[confirm meeting time]');

    await userEvent.click(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await userEvent.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('TC-1.10-A11Y-09: welcome heading has no exclamation mark', () => {
    render(<WelcomeStep />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).not.toMatch(/!/);
  });

  it('TC-1.10-A11Y-10: completion heading has no exclamation marks', () => {
    render(<CompletionStep />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).not.toMatch(/!/);
  });

  it('TC-1.10-A11Y-11: interactive elements are buttons', () => {
    render(<WelcomeStep />);
    const button = screen.getByRole('button', { name: 'Begin' });
    expect(button.tagName).toBe('BUTTON');
  });
});
