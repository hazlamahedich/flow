import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from '@testing-library/react';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../time/actions/create-time-entry', () => ({
  createTimeEntryAction: vi.fn(),
}));
vi.mock('../../../time/actions/list-projects', () => ({
  listProjectsAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

import { createTimeEntryAction } from '../../../time/actions/create-time-entry';
import { LogTimeModal } from '../../../time/components/log-time-modal';

const clients = [
  { id: 'c-1', name: 'Acme Corp' },
  { id: 'c-2', name: 'Beta LLC' },
];
const onClose = vi.fn();
const onCreated = vi.fn();

afterEach(() => {
  cleanup();
});
beforeEach(() => {
  vi.clearAllMocks();
});

async function renderModal() {
  const result = render(
    <LogTimeModal clients={clients} onClose={onClose} onCreated={onCreated} />,
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return result;
}

async function fillValidForm() {
  const clientSelect = screen.getByDisplayValue('Select client');
  fireEvent.change(clientSelect, { target: { value: 'c-1' } });
  const durationInput = screen.getByPlaceholderText('e.g. 90 for 1h 30m');
  fireEvent.change(durationInput, { target: { value: '60' } });
}

describe('LogTimeModal — UI State Coverage', () => {
  describe('[P1] Loading state', () => {
    it('disables submit during pending submission', async () => {
      vi.mocked(createTimeEntryAction).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  data: { id: 'te-1' },
                }),
              2000,
            ),
          ),
      );

      await renderModal();
      await fillValidForm();
      const submitBtn = screen.getByRole('button', { name: 'Log Time' });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(submitBtn).toBeDisabled();
      });
    });
  });

  describe('[P1] Empty state', () => {
    it('renders with no pre-filled values', async () => {
      await renderModal();
      expect(screen.getByDisplayValue('Select client')).toBeInTheDocument();
      const durationInput = screen.getByPlaceholderText('e.g. 90 for 1h 30m');
      expect(durationInput).toBeInTheDocument();
      expect((durationInput as HTMLInputElement).value).toBe('');
    });
  });

  describe('[P1] Validation error state', () => {
    it('clears previous error on next valid submission attempt', async () => {
      await renderModal();
      const clientSelect = screen.getByDisplayValue('Select client');
      fireEvent.change(clientSelect, { target: { value: 'c-1' } });
      const durationInput = screen.getByPlaceholderText('e.g. 90 for 1h 30m');
      fireEvent.change(durationInput, { target: { value: '0' } });
      const submitBtn = screen.getByRole('button', { name: 'Log Time' });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Minimum 1 minute')).toBeInTheDocument();
      });

      vi.mocked(createTimeEntryAction).mockResolvedValue({
        success: true,
        data: { id: 'te-1' },
      });

      fireEvent.change(durationInput, { target: { value: '60' } });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(screen.queryByText('Minimum 1 minute')).not.toBeInTheDocument();
      });
    });
  });

  describe('[P1] Server error state', () => {
    it('shows error on failed submit', async () => {
      vi.mocked(createTimeEntryAction).mockResolvedValue({
        success: false,
        error: {
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'fail',
          category: 'system',
        },
      });

      await renderModal();
      await fillValidForm();
      const submitBtn = screen.getByRole('button', { name: 'Log Time' });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('fail')).toBeInTheDocument();
      });
    });

    it('re-enables submit button after server error', async () => {
      vi.mocked(createTimeEntryAction).mockResolvedValue({
        success: false,
        error: {
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'fail',
          category: 'system',
        },
      });

      await renderModal();
      await fillValidForm();
      const submitBtn = screen.getByRole('button', { name: 'Log Time' });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(submitBtn).toBeEnabled();
      });
    });
  });

  describe('[P0] Permission-denied state', () => {
    it('shows error when server returns FORBIDDEN', async () => {
      vi.mocked(createTimeEntryAction).mockResolvedValue({
        success: false,
        error: {
          status: 403,
          code: 'FORBIDDEN',
          message: 'Not authorized',
          category: 'auth',
        },
      });

      await renderModal();
      await fillValidForm();
      const submitBtn = screen.getByRole('button', { name: 'Log Time' });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Not authorized')).toBeInTheDocument();
      });
    });
  });
});
