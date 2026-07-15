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

import { updateTimeEntryAction } from '../../actions/update-time-entry';
import { checkEntryInvoicedAction } from '../../actions/check-entry-invoiced';
import { EditTimeEntryModal } from '../edit-time-entry-modal';

const entry = {
  id: '00000000-0000-0000-0000-000000000001',
  clientId: '00000000-0000-0000-0000-000000000002',
  projectId: null,
  date: '2026-05-10',
  durationMinutes: 60,
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
});

function saveBtn() {
  return screen.getAllByText('Save Changes')[0];
}
function cancelBtn() {
  return screen.getAllByText('Cancel')[0];
}

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

describe('EditTimeEntryModal', () => {
  it('renders with Edit Time Entry title', async () => {
    await renderAndWait();
    expect(screen.getByText('Edit Time Entry')).toBeInTheDocument();
  });

  it('shows validation error for invalid duration', async () => {
    await renderAndWait();
    const durationInputs = screen.getAllByPlaceholderText(/90 for 1h 30m/);
    fireEvent.change(durationInputs[0], { target: { value: '0' } });
    await act(async () => {
      fireEvent.click(saveBtn());
    });
    await waitFor(() => {
      expect(screen.getByText('Minimum 1 minute')).toBeInTheDocument();
    });
  });

  it('calls onClose on cancel', async () => {
    await renderAndWait();
    fireEvent.click(cancelBtn());
    expect(onClose).toHaveBeenCalled();
  });

  it('calls updateTimeEntryAction on submit', async () => {
    vi.mocked(updateTimeEntryAction).mockResolvedValue({
      success: true,
      data: { id: 'te1', updatedAt: '2026-05-10' },
    });
    await renderAndWait();
    await act(async () => {
      fireEvent.click(saveBtn());
    });
    await waitFor(() => {
      expect(updateTimeEntryAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: entry.id }),
      );
    });
  });

  it('shows invoice warning when invoiced', async () => {
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
  });

  it('disables submit when invoiced and not acknowledged', async () => {
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
});
