import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/onboarding/welcome',
  useSearchParams: () => new URLSearchParams(),
}));

import { WelcomeStep } from '../../app/(onboarding)/onboarding/_components/steps/welcome-step';

describe('WelcomeStep', () => {
  afterEach(() => cleanup());

  it('renders heading without exclamation mark', () => {
    render(<WelcomeStep />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent("Let's set up your workspace");
    expect(heading.textContent).not.toMatch(/!/);
  });

  it('renders Begin CTA', () => {
    render(<WelcomeStep />);
    expect(screen.getByRole('button', { name: 'Begin' })).toBeInTheDocument();
  });

  it('uses professional voice — no emojis', () => {
    const { container } = render(<WelcomeStep />);
    expect(container.textContent).not.toMatch(/[\u{1F600}-\u{1F64F}]/u);
  });

  it('CTA is clickable and not disabled', () => {
    render(<WelcomeStep />);
    const button = screen.getByRole('button', { name: 'Begin' });
    expect(button).not.toBeDisabled();
  });
});
