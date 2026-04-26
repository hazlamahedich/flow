import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore } from 'jotai';
import { overlayStackAtom, type OverlayEntry } from '../../../../../lib/atoms/overlay';
import { mockMatchMedia } from './helpers/match-media-mock';

mockMatchMedia();

vi.mock('../../../../lib/hooks/use-trust-announcer', () => ({
  useTrustAnnouncer: () => vi.fn(),
}));

import { TrustMilestone } from '../trust-milestone';

function makeMilestoneEntry(
  milestoneType: string = 'FIRST_10',
): OverlayEntry {
  return {
    id: `milestone-${milestoneType}`,
    type: 'trust-milestone',
    priority: 30,
    props: {
      agentLabel: 'Inbox',
      milestoneType,
    },
    createdAt: Date.now(),
  };
}

function renderWithStore(store: ReturnType<typeof createStore>, entry: OverlayEntry) {
  return render(
    <Provider store={store}>
      <TrustMilestone entry={entry} />
    </Provider>,
  );
}

describe('TrustMilestone', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    store = createStore();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders FIRST_10 milestone', () => {
    renderWithStore(store, makeMilestoneEntry('FIRST_10'));
    expect(screen.getByText('10 tasks, building trust')).toBeInTheDocument();
  });

  it('renders FIFTY_CLEAN milestone', () => {
    renderWithStore(store, makeMilestoneEntry('FIFTY_CLEAN'));
    expect(screen.getByText('50 tasks, no stumbles')).toBeInTheDocument();
  });

  it('renders HUNDRED_CLEAN milestone', () => {
    renderWithStore(store, makeMilestoneEntry('HUNDRED_CLEAN'));
    expect(screen.getByText('100 tasks, no stumbles')).toBeInTheDocument();
  });

  it('renders ZERO_REJECTIONS_WEEK milestone', () => {
    renderWithStore(store, makeMilestoneEntry('ZERO_REJECTIONS_WEEK'));
    expect(screen.getByText('A perfect week')).toBeInTheDocument();
  });

  it('renders gold border on icon', () => {
    const { container } = renderWithStore(store, makeMilestoneEntry());
    const goldBorder = container.querySelector('.border-yellow-500');
    expect(goldBorder).toBeInTheDocument();
  });

  it('auto-dismisses after 8 seconds', () => {
    store.set(overlayStackAtom, { type: 'push', entry: makeMilestoneEntry() });
    renderWithStore(store, makeMilestoneEntry());
    act(() => {
      vi.advanceTimersByTime(8_000);
    });
    expect(store.get(overlayStackAtom)).toHaveLength(0);
  });

  it('manual dismiss via close button', async () => {
    store.set(overlayStackAtom, { type: 'push', entry: makeMilestoneEntry() });
    renderWithStore(store, makeMilestoneEntry());
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Dismiss'));
    });
    expect(store.get(overlayStackAtom)).toHaveLength(0);
  });

  it('does not show progress bars or countdowns', () => {
    const { container } = renderWithStore(store, makeMilestoneEntry());
    expect(container.querySelector('progress')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('pauses auto-dismiss timer on visibility hidden', () => {
    store.set(overlayStackAtom, { type: 'push', entry: makeMilestoneEntry() });
    renderWithStore(store, makeMilestoneEntry());
    act(() => { vi.advanceTimersByTime(4_000); });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    act(() => { vi.advanceTimersByTime(8_000); });
    expect(store.get(overlayStackAtom)).toHaveLength(1);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    act(() => { vi.advanceTimersByTime(4_000); });
    expect(store.get(overlayStackAtom)).toHaveLength(0);
  });
});
