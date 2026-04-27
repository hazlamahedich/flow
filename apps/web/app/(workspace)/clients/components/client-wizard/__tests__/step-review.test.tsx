import { describe, it, expect, vi } from 'vitest';
import { renderWithTheme } from '@flow/test-utils';
import { StepReview } from '../step-review';

describe('StepReview', () => {
  const noop = vi.fn();
  const ref = { current: null };

  const fullProps = {
    contactData: { name: 'Test Client', email: 'test@example.com', phone: '123-456', company_name: 'Acme' },
    billingData: { billing_email: 'billing@test.com', hourly_rate_cents: 5000, address: '123 Main St', notes: 'A note' },
    retainerData: null,
    retainerSkipped: false,
    onSubmit: noop,
    onGoToStep: noop,
    isSubmitting: false,
    error: null,
    headingRef: ref,
  };

  it('renders contact section with client name', () => {
    const { container } = renderWithTheme(<StepReview {...fullProps} />);
    expect(container.textContent).toContain('Test Client');
  });

  it('renders Edit links for each section', () => {
    const { container } = renderWithTheme(<StepReview {...fullProps} />);
    const editLinks = container.querySelectorAll('button');
    const editBtns = Array.from(editLinks).filter((b) => b.textContent === 'Edit');
    expect(editBtns.length).toBeGreaterThanOrEqual(2);
  });

  it('shows Create Client button', () => {
    const { container } = renderWithTheme(<StepReview {...fullProps} />);
    expect(container.textContent).toContain('Create Client');
  });

  it('shows loading text when submitting', () => {
    const { container } = renderWithTheme(<StepReview {...fullProps} isSubmitting={true} />);
    expect(container.textContent).toContain('Creating...');
  });

  it('shows error when provided', () => {
    const { container } = renderWithTheme(<StepReview {...fullProps} error="Something failed" />);
    expect(container.textContent).toContain('Something failed');
  });

  it('shows skipped retainer message', () => {
    const { container } = renderWithTheme(<StepReview {...fullProps} retainerSkipped={true} />);
    expect(container.textContent).toContain('Skipped');
  });

  it('disables button when submitting', () => {
    const { container } = renderWithTheme(<StepReview {...fullProps} isSubmitting={true} />);
    const btn = container.querySelector('button[disabled]');
    expect(btn).not.toBeNull();
  });
});
