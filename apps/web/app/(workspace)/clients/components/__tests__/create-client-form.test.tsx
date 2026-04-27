import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreateClientForm } from '../create-client-form';
import { TierLimitBanner } from '../tier-limit-banner';

vi.mock('../actions/create-client', () => ({
  createWorkspaceClient: vi.fn(),
}));

describe('CreateClientForm', () => {
  it('renders required name input', () => {
    render(<CreateClientForm activeCount={0} onSuccess={vi.fn()} />);
    const nameInput = screen.getByPlaceholderText(/client contact name/i);
    expect(nameInput).toBeTruthy();
  });

  it('renders company input', () => {
    render(<CreateClientForm activeCount={0} onSuccess={vi.fn()} />);
    expect(screen.getByLabelText(/company/i)).toBeTruthy();
  });

  it('renders hourly rate input', () => {
    render(<CreateClientForm activeCount={0} onSuccess={vi.fn()} />);
    expect(screen.getByLabelText(/hourly rate/i)).toBeTruthy();
  });

  it('renders submit button with correct text', () => {
    render(<CreateClientForm activeCount={0} onSuccess={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    const submitBtn = buttons.find((b) => b.textContent?.includes('Create Client'));
    expect(submitBtn).toBeTruthy();
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
