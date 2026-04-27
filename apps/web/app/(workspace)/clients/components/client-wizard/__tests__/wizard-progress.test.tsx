import { describe, it, expect, vi } from 'vitest';
import { renderWithTheme } from '@flow/test-utils';
import { WizardProgress } from '../wizard-progress';

describe('WizardProgress', () => {
  it('renders all 4 steps', () => {
    const { container } = renderWithTheme(<WizardProgress currentStep={1} />);
    const circles = container.querySelectorAll('[class*="rounded-full"]');
    expect(circles.length).toBeGreaterThanOrEqual(4);
  });

  it('has correct aria attributes', () => {
    const { container } = renderWithTheme(<WizardProgress currentStep={2} />);
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).not.toBeNull();
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('2');
    expect(progressbar?.getAttribute('aria-valuemin')).toBe('1');
    expect(progressbar?.getAttribute('aria-valuemax')).toBe('4');
    expect(progressbar?.getAttribute('aria-valuetext')).toContain('Step 2 of 4');
  });

  it('has sr-only text for screen readers', () => {
    const { container } = renderWithTheme(<WizardProgress currentStep={3} />);
    const srOnly = container.querySelector('.sr-only');
    expect(srOnly?.textContent).toContain('Step 3 of 4');
  });

  it('renders mobile progress bar', () => {
    const { container } = renderWithTheme(<WizardProgress currentStep={1} />);
    const mobileBar = container.querySelector('.block.sm\\:hidden');
    expect(mobileBar).not.toBeNull();
  });
});
