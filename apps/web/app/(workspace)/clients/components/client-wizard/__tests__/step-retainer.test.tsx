import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderWithTheme } from '@flow/test-utils';
import { fireEvent, cleanup, waitFor } from '@testing-library/react';
import { StepRetainer } from '../step-retainer';

describe('StepRetainer', () => {
  const noop = vi.fn();
  const ref = { current: null };

  afterEach(cleanup);

  it('shows "Set up retainer" and skip buttons when collapsed', () => {
    const { container } = renderWithTheme(
      <StepRetainer data={null} onChange={noop} onNext={noop} onBack={noop} onSkip={noop} headingRef={ref} />,
    );
    expect(container.textContent).toContain('Set up retainer');
    expect(container.textContent).toContain("I'll set this up later");
  });

  it('calls onSkip when skip button clicked', () => {
    const onSkip = vi.fn();
    const { container } = renderWithTheme(
      <StepRetainer data={null} onChange={noop} onNext={noop} onBack={noop} onSkip={onSkip} headingRef={ref} />,
    );
    const btns = container.querySelectorAll('button');
    const skipBtn = Array.from(btns).find((b) => b.textContent?.includes("I'll set this up later"));
    skipBtn?.click();
    expect(onSkip).toHaveBeenCalled();
  });

  it('expands retainer form on "Set up retainer" click', async () => {
    const { container } = renderWithTheme(
      <StepRetainer data={null} onChange={noop} onNext={noop} onBack={noop} onSkip={noop} headingRef={ref} />,
    );
    const btns = container.querySelectorAll('button');
    const setupBtn = Array.from(btns).find((b) => b.textContent === 'Set up retainer');
    fireEvent.click(setupBtn!);
    await waitFor(() => {
      expect(container.querySelectorAll('[role="radiogroup"]').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('has radiogroup with aria-label after expand', async () => {
    const { container } = renderWithTheme(
      <StepRetainer data={null} onChange={noop} onNext={noop} onBack={noop} onSkip={noop} headingRef={ref} />,
    );
    const btns = container.querySelectorAll('button');
    const setupBtn = Array.from(btns).find((b) => b.textContent === 'Set up retainer');
    fireEvent.click(setupBtn!);
    await waitFor(() => {
      const rg = container.querySelector('[role="radiogroup"]');
      expect(rg?.getAttribute('aria-label')).toBe('Retainer type');
    });
  });

  it('has 3 radio cards after expand', async () => {
    const { container } = renderWithTheme(
      <StepRetainer data={null} onChange={noop} onNext={noop} onBack={noop} onSkip={noop} headingRef={ref} />,
    );
    const btns = container.querySelectorAll('button');
    const setupBtn = Array.from(btns).find((b) => b.textContent === 'Set up retainer');
    fireEvent.click(setupBtn!);
    await waitFor(() => {
      const radios = container.querySelectorAll('[role="radio"]');
      expect(radios.length).toBe(3);
    });
  });

  it('uses "I\'ll set this up later" text (not "Skip")', () => {
    const { container } = renderWithTheme(
      <StepRetainer data={null} onChange={noop} onNext={noop} onBack={noop} onSkip={noop} headingRef={ref} />,
    );
    expect(container.textContent).toContain("I'll set this up later");
    expect(container.textContent).not.toContain('Skip for now');
  });
});
