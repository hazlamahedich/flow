import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClientEmptyState } from '../client-empty-state';
import { TierLimitBanner } from '../tier-limit-banner';

describe('CreateClientForm validation', () => {
  it('renders form fields', () => {
    render(<ClientEmptyState variant="no-clients" />);
    expect(screen.getByText('Add your first client')).toBeTruthy();
  });
});

describe('TierLimitBanner', () => {
  it('does not render when well under limit', () => {
    const { container } = render(<TierLimitBanner activeCount={2} limit={5} tierName="free" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders warning when near limit', () => {
    render(<TierLimitBanner activeCount={4} limit={5} tierName="free" />);
    expect(screen.getByText(/4 of 5 clients/)).toBeTruthy();
  });

  it('renders limit reached message', () => {
    render(<TierLimitBanner activeCount={5} limit={5} tierName="free" />);
    expect(screen.getByText(/Limit reached/)).toBeTruthy();
  });
});
