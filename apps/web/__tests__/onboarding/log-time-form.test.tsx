import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/onboarding/log-time',
  useSearchParams: () =>
    new URLSearchParams('clientId=cl-1&clientName=Acme+Corp'),
}));

const mockLogTimeEntry = vi.fn();
vi.mock(
  '../../app/(onboarding)/onboarding/_actions/log-time-entry',
  () => ({
    logTimeEntry: (...args: unknown[]) => mockLogTimeEntry(...args),
  }),
);

import { LogTimeForm } from '../../app/(onboarding)/onboarding/_components/steps/log-time-form';
describe('LogTimeForm', () => {
  beforeEach(() => {
    mockLogTimeEntry.mockReset();
  });

  afterEach(() => cleanup());

  it('pre-selects client from Step 3', () => {
    render(<LogTimeForm />);
    const clientInput = screen.getByLabelText('Client') as HTMLInputElement;
    expect(clientInput.value).toBe('Acme Corp');
    expect(clientInput.readOnly).toBe(true);
  });

  it('renders required fields', () => {
    render(<LogTimeForm />);
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText(/Duration/)).toBeInTheDocument();
  });

  it('disables submit when duration is empty', () => {
    render(<LogTimeForm />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls logTimeEntry with correct payload', async () => {
    mockLogTimeEntry.mockResolvedValue({
      success: true,
      data: { id: 'entry-1' },
    });

    render(<LogTimeForm />);
    await userEvent.type(screen.getByLabelText(/Duration/), '60');

    const submit = screen.getByRole('button');
    expect(submit).not.toBeDisabled();

    await userEvent.click(submit);

    await waitFor(() => {
      expect(mockLogTimeEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: 'cl-1',
          duration_minutes: 60,
        }),
      );
    });
  });

  it('enforces integer duration', () => {
    render(<LogTimeForm />);
    const durationInput = screen.getByLabelText(/Duration/) as HTMLInputElement;
    expect(durationInput.type).toBe('number');
    expect(durationInput.min).toBe('1');
  });

  it('navigates to completion on success', async () => {
    mockLogTimeEntry.mockResolvedValue({
      success: true,
      data: { id: 'entry-1' },
    });

    render(<LogTimeForm />);
    await userEvent.type(screen.getByLabelText(/Duration/), '30');
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockLogTimeEntry).toHaveBeenCalled();
    });
  });
});
