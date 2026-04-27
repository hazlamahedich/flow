import { describe, it, expect, vi } from 'vitest';
import { renderWithTheme } from '@flow/test-utils';
import { StepBilling } from '../step-billing';

describe('StepBilling', () => {
  const noop = vi.fn();
  const ref = { current: null };

  it('renders all optional fields', () => {
    const { container } = renderWithTheme(
      <StepBilling data={{}} onChange={noop} onNext={noop} onBack={noop} headingRef={ref} />,
    );
    expect(container.querySelector('#wiz-billing-email')).not.toBeNull();
    expect(container.querySelector('#wiz-rate')).not.toBeNull();
    expect(container.querySelector('#wiz-address')).not.toBeNull();
    expect(container.querySelector('#wiz-notes')).not.toBeNull();
  });

  it('shows optional hint text', () => {
    const { container } = renderWithTheme(
      <StepBilling data={{}} onChange={noop} onNext={noop} onBack={noop} headingRef={ref} />,
    );
    expect(container.textContent).toContain('Optional');
  });

  it('Next button is always enabled', () => {
    const { container } = renderWithTheme(
      <StepBilling data={{}} onChange={noop} onNext={noop} onBack={noop} headingRef={ref} />,
    );
    const btns = container.querySelectorAll('button');
    const nextBtn = Array.from(btns).find((b) => b.textContent === 'Next');
    expect(nextBtn?.disabled).toBe(false);
  });

  it('shows character counter for notes', () => {
    const { container } = renderWithTheme(
      <StepBilling data={{ notes: 'hello' }} onChange={noop} onNext={noop} onBack={noop} headingRef={ref} />,
    );
    expect(container.textContent).toContain('/5000');
  });

  it('renders Back button', () => {
    const { container } = renderWithTheme(
      <StepBilling data={{}} onChange={noop} onNext={noop} onBack={noop} headingRef={ref} />,
    );
    const btns = container.querySelectorAll('button');
    const backBtn = Array.from(btns).find((b) => b.textContent === 'Back');
    expect(backBtn).not.toBeUndefined();
  });
});
