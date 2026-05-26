import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })),
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../actions/create-time-entry', () => ({ createTimeEntryAction: vi.fn() }));
vi.mock('../../actions/create-project', () => ({ createProjectAction: vi.fn() }));
vi.mock('../../actions/list-projects', () => ({
  listProjectsAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

import { createTimeEntryAction } from '../../actions/create-time-entry';
import { createProjectAction } from '../../actions/create-project';
import { LogTimeModal } from '../log-time-modal';

const clients = [
  { id: 'c-1', name: 'Acme Corp' },
  { id: 'c-2', name: 'Beta LLC' },
];
const onClose = vi.fn();
const onCreated = vi.fn();

afterEach(() => { cleanup(); });
beforeEach(() => { vi.clearAllMocks(); });

async function renderModal() {
  const result = render(
    <LogTimeModal clients={clients} onClose={onClose} onCreated={onCreated} />,
  );
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return result;
}

describe('LogTimeModal', () => {
  it('[P1] renders with Log Time title', async () => {
    await renderModal();
    expect(screen.getByRole('heading', { name: 'Log Time' })).toBeInTheDocument();
  });

  it('[P1] shows validation error for missing client', async () => {
    await renderModal();
    const submitBtn = screen.getByRole('button', { name: 'Log Time' });
    await act(async () => { fireEvent.click(submitBtn); });
    await waitFor(() => {
      expect(screen.getByText('Client is required')).toBeInTheDocument();
    });
  });

  it('[P1] shows validation error for duration < 1', async () => {
    await renderModal();
    const clientSelect = screen.getByDisplayValue('Select client');
    fireEvent.change(clientSelect, { target: { value: 'c-1' } });
    const durationInput = screen.getByPlaceholderText('e.g. 90 for 1h 30m');
    fireEvent.change(durationInput, { target: { value: '0' } });
    const submitBtn = screen.getByRole('button', { name: 'Log Time' });
    await act(async () => { fireEvent.click(submitBtn); });
    await waitFor(() => {
      expect(screen.getByText('Minimum 1 minute')).toBeInTheDocument();
    });
  });

  it('[P1] shows validation error for duration > 1440', async () => {
    await renderModal();
    const clientSelect = screen.getByDisplayValue('Select client');
    fireEvent.change(clientSelect, { target: { value: 'c-1' } });
    const durationInput = screen.getByPlaceholderText('e.g. 90 for 1h 30m');
    fireEvent.change(durationInput, { target: { value: '1500' } });
    const submitBtn = screen.getByRole('button', { name: 'Log Time' });
    await act(async () => { fireEvent.click(submitBtn); });
    await waitFor(() => {
      expect(screen.getByText('Maximum 1440 minutes')).toBeInTheDocument();
    });
  });

  it('[P1] calls createTimeEntryAction on valid submit', async () => {
    vi.mocked(createTimeEntryAction).mockResolvedValue({
      success: true,
      data: { id: 'te-1', clientId: 'c-1', projectId: null, date: '2026-05-10', durationMinutes: 60, notes: null },
    });

    await renderModal();
    const clientSelect = screen.getByDisplayValue('Select client');
    fireEvent.change(clientSelect, { target: { value: 'c-1' } });
    const durationInput = screen.getByPlaceholderText('e.g. 90 for 1h 30m');
    fireEvent.change(durationInput, { target: { value: '60' } });
    const submitBtn = screen.getByRole('button', { name: 'Log Time' });
    await act(async () => { fireEvent.click(submitBtn); });

    await waitFor(() => {
      expect(createTimeEntryAction).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'c-1', durationMinutes: 60 }),
      );
    });
  });

  it('[P1] closes on Cancel click', async () => {
    await renderModal();
    const cancelBtn = screen.getByText('Cancel');
    await act(async () => { fireEvent.click(cancelBtn); });
    expect(onClose).toHaveBeenCalled();
  });

  it('[P1] closes on backdrop click', async () => {
    await renderModal();
    const backdrop = document.querySelector('.fixed.inset-0');
    expect(backdrop).toBeTruthy();
    await act(async () => { fireEvent.click(backdrop!); });
    expect(onClose).toHaveBeenCalled();
  });

  it('[P1] shows error on failed submit', async () => {
    vi.mocked(createTimeEntryAction).mockResolvedValue({
      success: false,
      error: { status: 500, code: 'INTERNAL_ERROR', message: 'fail', category: 'system' },
    });

    await renderModal();
    const clientSelect = screen.getByDisplayValue('Select client');
    fireEvent.change(clientSelect, { target: { value: 'c-1' } });
    const durationInput = screen.getByPlaceholderText('e.g. 90 for 1h 30m');
    fireEvent.change(durationInput, { target: { value: '30' } });
    const submitBtn = screen.getByRole('button', { name: 'Log Time' });
    await act(async () => { fireEvent.click(submitBtn); });

    await waitFor(() => {
      expect(screen.getByText('fail')).toBeInTheDocument();
    });
  });
});
