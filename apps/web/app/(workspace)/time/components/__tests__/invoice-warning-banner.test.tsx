import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { InvoiceWarningBanner } from '../invoice-warning-banner';

afterEach(() => {
  cleanup();
});

describe('InvoiceWarningBanner', () => {
  it('renders warning text', () => {
    const { container } = render(
      <InvoiceWarningBanner onAcknowledge={() => {}} acknowledged={false} />,
    );
    expect(container.textContent).toContain('included in an invoice');
  });

  it('has role="alert" on container', () => {
    const { container } = render(
      <InvoiceWarningBanner onAcknowledge={() => {}} acknowledged={false} />,
    );
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
  });

  it('calls onAcknowledge(true) when checkbox state changes to checked', () => {
    const onAck = vi.fn();
    const { container } = render(
      <InvoiceWarningBanner onAcknowledge={onAck} acknowledged={false} />,
    );
    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onAck).toHaveBeenCalledWith(true);
  });

  it('calls onAcknowledge(false) when checkbox state changes to unchecked', () => {
    const onAck = vi.fn();
    const { container } = render(
      <InvoiceWarningBanner onAcknowledge={onAck} acknowledged={true} />,
    );
    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onAck).toHaveBeenCalledWith(false);
  });
});
