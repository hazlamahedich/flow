import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore } from 'jotai';
import { overlayStackAtom, type OverlayEntry } from '../../../../../lib/atoms/overlay';
import { mockMatchMedia } from './helpers/match-media-mock';

mockMatchMedia();

vi.mock('../../actions/trust-actions', () => ({
  undoRegression: vi.fn().mockResolvedValue({
    success: true,
    data: { matrixEntryId: 'm1', fromLevel: 'confirm', toLevel: 'auto', version: 3 },
  }),
}));

vi.mock('../../../../lib/hooks/use-trust-announcer', () => ({
  useTrustAnnouncer: () => vi.fn(),
}));

import { TrustRecovery } from '../trust-recovery';

function makeRecoveryEntry(overrides: Partial<OverlayEntry> = {}): OverlayEntry {
  return {
    id: 'recovery-1',
    type: 'trust-recovery',
    priority: 60,
    props: {
      agentId: 'inbox',
      agentLabel: 'Inbox',
      capabilities: ['email categorization', 'draft responses'],
      affectedTasksCount: 3,
      triggerReason: '3 failed task completions in 24h',
      isAutoTriggered: true,
      matrixEntryId: 'm1',
      transitionId: 't1',
      expectedVersion: 2,
      cleanApprovals: 8,
      rejectionCount: 1,
    },
    createdAt: Date.now(),
    ...overrides,
  };
}

function renderWithStore(store: ReturnType<typeof createStore>, entry: OverlayEntry) {
  return render(
    <Provider store={store}>
      <TrustRecovery entry={entry} />
    </Provider>,
  );
}

describe('TrustRecovery', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with behavioral title', () => {
    renderWithStore(store, makeRecoveryEntry());
    expect(screen.getByText("We've Adjusted Inbox's Permissions")).toBeInTheDocument();
  });

  it('never shows "Trust level decreased" or "Agent failed"', () => {
    renderWithStore(store, makeRecoveryEntry());
    const body = document.body.textContent ?? '';
    expect(body).not.toContain('Trust level decreased');
    expect(body).not.toContain('Agent failed');
    expect(body).not.toContain('Agent Permissions Updated');
  });

  it('shows capability list in summary', () => {
    renderWithStore(store, makeRecoveryEntry());
    expect(screen.getByText(/email categorization, draft responses/)).toBeInTheDocument();
  });

  it('shows tasks paused count', () => {
    renderWithStore(store, makeRecoveryEntry());
    expect(screen.getByText(/3 tasks using these capabilities paused/)).toBeInTheDocument();
  });

  it('shows trigger reason', () => {
    renderWithStore(store, makeRecoveryEntry());
    expect(screen.getByText(/3 failed task completions in 24h/)).toBeInTheDocument();
  });

  it('shows accumulated trust data', () => {
    renderWithStore(store, makeRecoveryEntry());
    expect(screen.getByText(/8 clean approvals, 1 rejection/)).toBeInTheDocument();
  });

  it('shows Undo button when auto-triggered', () => {
    renderWithStore(store, makeRecoveryEntry());
    expect(screen.getByText('Undo — Restore previous permissions')).toBeInTheDocument();
  });

  it('hides Undo button when not auto-triggered', () => {
    renderWithStore(store, makeRecoveryEntry({
      props: { ...makeRecoveryEntry().props, isAutoTriggered: false },
    }));
    expect(screen.queryByText('Undo — Restore previous permissions')).not.toBeInTheDocument();
  });

  it('calls undoRegression on Undo click', async () => {
    const { undoRegression } = await import('../../actions/trust-actions');
    renderWithStore(store, makeRecoveryEntry());
    await act(async () => {
      fireEvent.click(screen.getByText('Undo — Restore previous permissions'));
    });
    expect(undoRegression).toHaveBeenCalledWith({
      transitionId: 't1',
      matrixEntryId: 'm1',
      expectedVersion: 2,
    });
  });

  it('shows "Trust level restored." after successful undo', async () => {
    renderWithStore(store, makeRecoveryEntry());
    await act(async () => {
      fireEvent.click(screen.getByText('Undo — Restore previous permissions'));
    });
    expect(screen.getByText('Trust level restored.')).toBeInTheDocument();
  });

  it('shows error message when undo fails', async () => {
    const { undoRegression } = await import('../../actions/trust-actions');
    (undoRegression as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: false,
      error: { message: 'fail' },
    });
    renderWithStore(store, makeRecoveryEntry());
    await act(async () => {
      fireEvent.click(screen.getByText('Undo — Restore previous permissions'));
    });
    expect(screen.getByText('Could not undo. Please try again.')).toBeInTheDocument();
  });

  it('shows acknowledge button', () => {
    renderWithStore(store, makeRecoveryEntry());
    expect(screen.getByText('I understand')).toBeInTheDocument();
  });

  it('closes on acknowledge', async () => {
    store.set(overlayStackAtom, { type: 'push', entry: makeRecoveryEntry() });
    renderWithStore(store, makeRecoveryEntry());
    await act(async () => {
      fireEvent.click(screen.getByText('I understand'));
    });
    expect(store.get(overlayStackAtom)).toHaveLength(0);
  });

  it('has role="alertdialog"', () => {
    renderWithStore(store, makeRecoveryEntry());
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('Escape focuses acknowledge button first press', async () => {
    store.set(overlayStackAtom, { type: 'push', entry: makeRecoveryEntry() });
    renderWithStore(store, makeRecoveryEntry());
    await act(async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    });
    const dialog = screen.getByRole('alertdialog');
    const ackBtn = screen.getByRole('button', { name: 'I understand' });
    act(() => {
      dialog.focus();
    });
    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    expect(ackBtn).toHaveFocus();
  });

  it('Escape second press acknowledges (closes)', async () => {
    store.set(overlayStackAtom, { type: 'push', entry: makeRecoveryEntry() });
    renderWithStore(store, makeRecoveryEntry());
    const dialog = screen.getByRole('alertdialog');
    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    expect(store.get(overlayStackAtom)).toHaveLength(0);
  });

  it('handles server error on undo gracefully', async () => {
    const { undoRegression } = await import('../../actions/trust-actions');
    (undoRegression as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'));
    renderWithStore(store, makeRecoveryEntry());
    await act(async () => {
      fireEvent.click(screen.getByText('Undo — Restore previous permissions'));
    });
    expect(screen.getByText('Could not undo. Please try again.')).toBeInTheDocument();
  });

  it('shows loading state during undo', async () => {
    const { undoRegression } = await import('../../actions/trust-actions');
    let resolveFn: (v: unknown) => void;
    (undoRegression as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise((r) => { resolveFn = r; }),
    );
    renderWithStore(store, makeRecoveryEntry());
    act(() => {
      fireEvent.click(screen.getByText('Undo — Restore previous permissions'));
    });
    expect(screen.getByText('Undoing…')).toBeInTheDocument();
    await act(async () => { resolveFn!({ success: true, data: {} }); });
  });

  it('disables double-undo after first undo succeeds', async () => {
    renderWithStore(store, makeRecoveryEntry());
    await act(async () => {
      fireEvent.click(screen.getByText('Undo — Restore previous permissions'));
    });
    expect(screen.queryByText('Undo — Restore previous permissions')).not.toBeInTheDocument();
  });

  it('handles zero affected tasks', () => {
    renderWithStore(store, makeRecoveryEntry({
      props: { ...makeRecoveryEntry().props, affectedTasksCount: 0 },
    }));
    expect(screen.queryByText(/tasks using these capabilities paused/)).not.toBeInTheDocument();
  });

  it('handles zero rejections gracefully', () => {
    renderWithStore(store, makeRecoveryEntry({
      props: { ...makeRecoveryEntry().props, rejectionCount: 0, cleanApprovals: 0 },
    }));
    expect(screen.queryByText(/clean approvals/)).not.toBeInTheDocument();
  });
});
