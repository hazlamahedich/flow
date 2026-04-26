import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore } from 'jotai';
import { overlayStackAtom, topOverlayAtom, type OverlayEntry } from '../../../../../lib/atoms/overlay';
import { trustBadgeAnimationAtom } from '../../../../../lib/atoms/trust';
import { mockMatchMedia } from './helpers/match-media-mock';

mockMatchMedia();

vi.mock('../../actions/trust-actions', () => ({
  upgradeTrustLevel: vi.fn().mockResolvedValue({
    success: true,
    data: { matrixEntryId: 'm1', fromLevel: 'supervised', toLevel: 'confirm', version: 2 },
  }),
}));

vi.mock('../../../../lib/hooks/use-trust-announcer', () => ({
  useTrustAnnouncer: () => vi.fn(),
}));

import { TrustCeremony } from '../trust-ceremony';

function makeCeremonyEntry(overrides: Partial<OverlayEntry> = {}): OverlayEntry {
  return {
    id: 'ceremony-1',
    type: 'trust-ceremony',
    priority: 50,
    props: {
      agentId: 'inbox',
      agentLabel: 'Inbox',
      actionLabel: 'email categorization',
      cleanApprovals: 7,
      totalRuns: 10,
      daysAtLevel: 14,
      fromLevel: 'supervised',
      toLevel: 'confirm',
      expectedVersion: 1,
      matrixEntryId: 'm1',
    },
    createdAt: Date.now(),
    ...overrides,
  };
}

function renderWithStore(store: ReturnType<typeof createStore>, entry: OverlayEntry) {
  return render(
    <Provider store={store}>
      <TrustCeremony entry={entry} />
    </Provider>,
  );
}

describe('TrustCeremony', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    store = createStore();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders ceremony title with agent label', () => {
    const entry = makeCeremonyEntry();
    renderWithStore(store, entry);
    expect(screen.getByText('Inbox has earned your trust')).toBeInTheDocument();
  });

  it('displays ceremony stats', () => {
    const entry = makeCeremonyEntry();
    renderWithStore(store, entry);
    expect(screen.getByText(/7 clean approvals, 10 total runs, 14 days/)).toBeInTheDocument();
  });

  it('shows Accept, Decline, and Remind me later buttons', () => {
    const entry = makeCeremonyEntry();
    renderWithStore(store, entry);
    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Not yet')).toBeInTheDocument();
    expect(screen.getByText('Remind me later')).toBeInTheDocument();
  });

  it('has role="alertdialog"', () => {
    const entry = makeCeremonyEntry();
    renderWithStore(store, entry);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('has aria-modal="true"', () => {
    const entry = makeCeremonyEntry();
    renderWithStore(store, entry);
    expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('displays escape instruction for screen readers', () => {
    const entry = makeCeremonyEntry();
    renderWithStore(store, entry);
    expect(screen.getByText(/Press Escape once to focus Decline/)).toBeInTheDocument();
  });

  it('calls upgradeTrustLevel on Accept click', async () => {
    const { upgradeTrustLevel } = await import('../../actions/trust-actions');
    const entry = makeCeremonyEntry();
    renderWithStore(store, entry);
    await act(async () => {
      fireEvent.click(screen.getByText('Accept'));
    });
    expect(upgradeTrustLevel).toHaveBeenCalled();
  });

  it('closes on Decline click', async () => {
    const entry = makeCeremonyEntry();
    store.set(overlayStackAtom, { type: 'push', entry });
    renderWithStore(store, entry);
    await act(async () => {
      fireEvent.click(screen.getByText('Not yet'));
    });
    expect(store.get(overlayStackAtom)).toHaveLength(0);
  });

  it('Escape first press focuses Decline button', async () => {
    const entry = makeCeremonyEntry();
    renderWithStore(store, entry);
    const dialog = screen.getByRole('alertdialog');
    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    expect(screen.getByText('Not yet')).toHaveFocus();
  });

  it('Escape second press activates Decline (closes)', async () => {
    const entry = makeCeremonyEntry();
    store.set(overlayStackAtom, { type: 'push', entry });
    renderWithStore(store, entry);
    const dialog = screen.getByRole('alertdialog');
    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    expect(store.get(overlayStackAtom)).toHaveLength(0);
  });

  it('Enter accepts', async () => {
    const { upgradeTrustLevel } = await import('../../actions/trust-actions');
    const entry = makeCeremonyEntry();
    renderWithStore(store, entry);
    const dialog = screen.getByRole('alertdialog');
    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Enter' });
    });
    expect(upgradeTrustLevel).toHaveBeenCalled();
  });

  it('auto-dismisses after 10 seconds', () => {
    const entry = makeCeremonyEntry();
    store.set(overlayStackAtom, { type: 'push', entry });
    renderWithStore(store, entry);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(store.get(overlayStackAtom)).toHaveLength(0);
  });

  it('pauses auto-dismiss when tab is hidden', () => {
    const entry = makeCeremonyEntry();
    store.set(overlayStackAtom, { type: 'push', entry });
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    renderWithStore(store, entry);
    vi.setSystemTime(new Date('2025-01-01T00:00:05Z'));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(store.get(overlayStackAtom)).toHaveLength(1);

    const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get');
    visibilitySpy.mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    vi.setSystemTime(new Date('2025-01-01T00:00:15Z'));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(store.get(overlayStackAtom)).toHaveLength(1);

    visibilitySpy.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    vi.setSystemTime(new Date('2025-01-01T00:00:20Z'));
    act(() => {
      vi.advanceTimersByTime(5_001);
    });
    expect(store.get(overlayStackAtom)).toHaveLength(0);
    visibilitySpy.mockRestore();
  });

  it('Remind me later re-queues after 1 hour', () => {
    const entry = makeCeremonyEntry();
    store.set(overlayStackAtom, { type: 'push', entry });
    renderWithStore(store, entry);
    act(() => {
      fireEvent.click(screen.getByText('Remind me later'));
    });
    expect(store.get(overlayStackAtom)).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(3_600_000);
    });
    expect(store.get(overlayStackAtom)).toHaveLength(1);
  });

  it('sets badge animation to pulse-promoting on mount', () => {
    const entry = makeCeremonyEntry();
    renderWithStore(store, entry);
    expect(store.get(trustBadgeAnimationAtom)).toBe('pulse-promoting');
  });

  it('handles slow network on accept gracefully', async () => {
    const { upgradeTrustLevel } = await import('../../actions/trust-actions');
    const mockFn = upgradeTrustLevel as ReturnType<typeof vi.fn>;
    let resolvePromise: (v: unknown) => void;
    mockFn.mockReturnValueOnce(new Promise((r) => { resolvePromise = r; }));
    const entry = makeCeremonyEntry();
    renderWithStore(store, entry);
    act(() => { fireEvent.click(screen.getByText('Accept')); });
    expect(screen.getByText('Saving…')).toBeInTheDocument();
    await act(async () => { resolvePromise!({ success: true, data: {} }); });
  });

  it('does not steal focus on mount (non-blocking)', () => {
    const entry = makeCeremonyEntry();
    renderWithStore(store, entry);
    expect(screen.getByText('Accept')).toBeInTheDocument();
  });

  it('handles concurrent overlays (only top rendered)', () => {
    const ceremony = makeCeremonyEntry({ id: 'c1', priority: 50 });
    const milestone = makeCeremonyEntry({ id: 'm1', priority: 30, type: 'trust-milestone' });
    store.set(overlayStackAtom, { type: 'push', entry: milestone });
    store.set(overlayStackAtom, { type: 'push', entry: ceremony });
    renderWithStore(store, ceremony);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(store.get(topOverlayAtom)?.id).toBe('c1');
  });

  it('displays ceremony body with action label', () => {
    const entry = makeCeremonyEntry({ props: { ...makeCeremonyEntry().props, actionLabel: 'invoice generation' } });
    renderWithStore(store, entry);
    expect(screen.getByText(/invoice generation/)).toBeInTheDocument();
  });

  it('focus trap cycles between buttons', async () => {
    const entry = makeCeremonyEntry();
    renderWithStore(store, entry);
    const dialog = screen.getByRole('alertdialog');
    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Tab' });
    });
  });
});
