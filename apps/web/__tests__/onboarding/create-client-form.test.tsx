import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/onboarding/create-client',
  useSearchParams: () => new URLSearchParams(),
}));

const mockCreateClient = vi.fn();
vi.mock(
  '../../app/(onboarding)/onboarding/_actions/create-client',
  () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
  }),
);

import { CreateClientForm } from '../../app/(onboarding)/onboarding/_components/steps/create-client-form';

describe('CreateClientForm', () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });

  afterEach(() => cleanup());

  it('renders all labels', () => {
    render(<CreateClientForm />);
    expect(screen.getByLabelText('Client name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone (optional)')).toBeInTheDocument();
  });

  it('requires name field', () => {
    render(<CreateClientForm />);
    const nameInput = screen.getByLabelText('Client name') as HTMLInputElement;
    expect(nameInput.required).toBe(true);
  });

  it('disables submit when name is empty', () => {
    render(<CreateClientForm />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls createClient on valid submission', async () => {
    mockCreateClient.mockResolvedValue({
      success: true,
      data: { id: 'client-1', name: 'Acme Corp' },
    });

    render(<CreateClientForm />);
    await userEvent.type(screen.getByLabelText('Client name'), 'Acme Corp');

    const submit = screen.getByRole('button');
    expect(submit).not.toBeDisabled();

    await userEvent.click(submit);

    await waitFor(() => {
      expect(mockCreateClient).toHaveBeenCalledWith({
        name: 'Acme Corp',
        email: '',
        phone: '',
      });
    });
  });

  it('displays inline error on server error', async () => {
    mockCreateClient.mockResolvedValue({
      success: false,
      error: {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Failed to create client',
        category: 'system',
      },
    });

    render(<CreateClientForm />);
    await userEvent.type(screen.getByLabelText('Client name'), 'Test Client');
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to create client');
    });
  });

  it('name input has aria-describedby when error exists', async () => {
    mockCreateClient.mockResolvedValue({
      success: false,
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Client name is required',
        category: 'validation',
      },
    });

    render(<CreateClientForm />);
    await userEvent.type(screen.getByLabelText('Client name'), 'A');
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
