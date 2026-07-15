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
vi.mock('../../actions/update-time-entry', () => ({
  updateTimeEntryAction: vi.fn(),
}));
vi.mock('../../actions/check-entry-invoiced', () => ({
  checkEntryInvoicedAction: vi
    .fn()
    .mockResolvedValue({ success: true, data: { invoiced: false } }),
}));
vi.mock('../../actions/list-projects', () => ({
  listProjectsAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

import { toast } from 'sonner';
import { updateTimeEntryAction } from '../../actions/update-time-entry';
import { checkEntryInvoicedAction } from '../../actions/check-entry-invoiced';
import { listProjectsAction } from '../../actions/list-projects';
import { EditTimeEntryModal } from '../edit-time-entry-modal';

const entry = {
  id: '00000000-0000-0000-0000-000000000001',
  clientId: '00000000-0000-0000-0000-000000000002',
  projectId: null,
  date: '2026-05-10',
  durationMinutes: 60,
  startMinutes: null,
  endMinutes: null,
  notes: 'Test note',
};
const clients = [
  { id: '00000000-0000-0000-0000-000000000002', name: 'Acme Corp' },
];
const onClose = vi.fn();
const onUpdated = vi.fn();

afterEach(() => {
  cleanup();
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkEntryInvoicedAction).mockResolvedValue({
    success: true,
    data: { invoiced: false },
  });
  vi.mocked(listProjectsAction).mockResolvedValue({ success: true, data: [] });
});

async function renderAndWait() {
  const result = render(
    <EditTimeEntryModal
      entry={entry}
      clients={clients}
      onClose={onClose}
      onUpdated={onUpdated}
    />,
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return result;
}

function saveBtn() {
  return screen.getAllByText('Save Changes')[0];
}

describe('EditTimeEntryModal — UI State Coverage', () => {
  describe('[P1] Loading state', () => {
    it('disables save button during submission', async () => {
      let resolveSubmit: (
        value:
          | { success: true; data: { id: string; updatedAt: string } }
          | PromiseLike<{
              success: true;
              data: { id: string; updatedAt: string };
            }>,
      ) => void;
      vi.mocked(updateTimeEntryAction).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSubmit = resolve;
          }),
      );

      await renderAndWait();
      const btn = saveBtn();
      await act(async () => {
        fireEvent.click(btn!);
      });

      expect(btn).toBeDisabled();

      await act(async () => {
        resolveSubmit({
          success: true,
          data: { id: 'te1', updatedAt: '2026-05-10' },
        });
      });
    });
  });

  describe('[P0] Permission-denied state', () => {
    it('shows error via toast and setError on FORBIDDEN', async () => {
      vi.mocked(updateTimeEntryAction).mockResolvedValue({
        success: false,
        error: {
          status: 403,
          code: 'FORBIDDEN',
          message: 'You do not have permission',
          category: 'auth',
        },
      });

      await renderAndWait();
      await act(async () => {
        fireEvent.click(saveBtn()!);
      });

      await waitFor(() => {
        expect(updateTimeEntryAction).toHaveBeenCalledWith(
          expect.objectContaining({ id: entry.id }),
        );
      });

      expect(toast.error).toHaveBeenCalledWith('You do not have permission');
    });
  });

  describe('[P0] Invoice warning state', () => {
    it('disables save when invoiced and not acknowledged', async () => {
      vi.mocked(checkEntryInvoicedAction).mockResolvedValue({
        success: true,
        data: { invoiced: true },
      });

      await renderAndWait();
      await waitFor(() => {
        expect(
          screen.getAllByText(/included in an invoice/i).length,
        ).toBeGreaterThanOrEqual(1);
      });

      expect(saveBtn()).toBeDisabled();
    });

    it('enables save after invoice warning acknowledged', async () => {
      vi.mocked(checkEntryInvoicedAction).mockResolvedValue({
        success: true,
        data: { invoiced: true },
      });
      vi.mocked(updateTimeEntryAction).mockResolvedValue({
        success: true,
        data: { id: 'te1', updatedAt: '2026-05-10' },
      });

      await renderAndWait();
      await waitFor(() => {
        expect(
          screen.getAllByText(/included in an invoice/i).length,
        ).toBeGreaterThanOrEqual(1);
      });

      expect(saveBtn()).toBeDisabled();

      const checkbox = document.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(saveBtn()).toBeEnabled();
      });
    });
  });

  describe('[P1] Error recovery state', () => {
    it('re-enables save after server error', async () => {
      vi.mocked(updateTimeEntryAction).mockResolvedValue({
        success: false,
        error: {
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'Server error',
          category: 'system',
        },
      });

      await renderAndWait();
      const btn = saveBtn();
      await act(async () => {
        fireEvent.click(btn!);
      });

      await waitFor(() => {
        expect(btn).toBeEnabled();
      });
    });
  });

  describe('[P1] Concurrent edit state', () => {
    it('surfaces CONFLICT error via toast', async () => {
      vi.mocked(updateTimeEntryAction).mockResolvedValue({
        success: false,
        error: {
          status: 409,
          code: 'CONFLICT',
          message: 'Modified concurrently',
          category: 'validation',
        },
      });

      await renderAndWait();
      await act(async () => {
        fireEvent.click(saveBtn()!);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Modified concurrently');
      });
    });
  });
});
