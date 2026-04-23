import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore } from 'jotai/vanilla';
import { shortcutOverlayOpenAtom } from '@flow/shared';
import { ShortcutOverlay } from './shortcut-overlay';

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: () => null,
  };
}

function renderOverlay(store?: ReturnType<typeof createStore>) {
  const testStore = store ?? createStore();
  return render(
    <Provider store={testStore}>
      <ShortcutOverlay />
    </Provider>,
  );
}

describe('ShortcutOverlay', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage());
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
  });

  it('renders nothing when closed', () => {
    const store = createStore();
    const { container } = renderOverlay(store);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders dialog when open', () => {
    const store = createStore();
    store.set(shortcutOverlayOpenAtom, true);
    const { container } = renderOverlay(store);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('has aria-label="Keyboard shortcuts"', () => {
    const store = createStore();
    store.set(shortcutOverlayOpenAtom, true);
    const { container } = renderOverlay(store);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-label')).toBe('Keyboard shortcuts');
  });

  it('closes on Escape', async () => {
    const store = createStore();
    store.set(shortcutOverlayOpenAtom, true);
    const { container } = renderOverlay(store);
    await act(async () => {
      fireEvent.keyDown(container.ownerDocument, { key: 'Escape' });
    });
    expect(store.get(shortcutOverlayOpenAtom)).toBe(false);
  });

  it('closes on backdrop click', async () => {
    const store = createStore();
    store.set(shortcutOverlayOpenAtom, true);
    const { container } = renderOverlay(store);
    const backdrop = container.querySelector('[data-testid="shortcut-overlay-backdrop"]');
    await act(async () => {
      fireEvent.click(backdrop!);
    });
    expect(store.get(shortcutOverlayOpenAtom)).toBe(false);
  });

  it('shows shortcut groups', () => {
    const store = createStore();
    store.set(shortcutOverlayOpenAtom, true);
    const { getByText, getAllByText } = renderOverlay(store);
    expect(getByText('Keyboard Shortcuts')).toBeTruthy();
    expect(getAllByText(/Open command palette/).length).toBeGreaterThan(0);
  });
});
