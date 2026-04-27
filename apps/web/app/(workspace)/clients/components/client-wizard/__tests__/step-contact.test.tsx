import { describe, it, expect, vi } from 'vitest';
import { renderWithTheme } from '@flow/test-utils';
import { fireEvent } from '@testing-library/react';
import { StepContact } from '../step-contact';

describe('StepContact', () => {
  const noop = vi.fn();
  const ref = { current: null };

  it('renders name field', () => {
    const { container } = renderWithTheme(
      <StepContact data={{ name: '' }} onChange={noop} onNext={noop} headingRef={ref} />,
    );
    expect(container.querySelector('#wiz-name')).not.toBeNull();
  });

  it('disables Next when name is empty', () => {
    const { container } = renderWithTheme(
      <StepContact data={{ name: '' }} onChange={noop} onNext={noop} headingRef={ref} />,
    );
    const btn = container.querySelector('button[disabled]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
  });

  it('enables Next when name is valid', () => {
    const { container } = renderWithTheme(
      <StepContact data={{ name: 'Test Client' }} onChange={noop} onNext={noop} headingRef={ref} />,
    );
    const btn = container.querySelector('button:not([disabled])') as HTMLButtonElement;
    expect(btn).not.toBeNull();
  });

  it('renders email, phone, and company fields', () => {
    const { container } = renderWithTheme(
      <StepContact data={{ name: 'Test' }} onChange={noop} onNext={noop} headingRef={ref} />,
    );
    expect(container.querySelector('#wiz-email')).not.toBeNull();
    expect(container.querySelector('#wiz-phone')).not.toBeNull();
    expect(container.querySelector('#wiz-company')).not.toBeNull();
  });

  it('calls onChange when name input changes', () => {
    const onChange = vi.fn();
    const { container } = renderWithTheme(
      <StepContact data={{ name: '' }} onChange={onChange} onNext={noop} headingRef={ref} />,
    );
    const input = container.querySelector('#wiz-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New' } });
    expect(onChange).toHaveBeenCalled();
  });
});
