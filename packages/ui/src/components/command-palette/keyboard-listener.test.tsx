import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore } from 'jotai/vanilla';
import { commandPaletteOpenAtom } from '@flow/shared';
import { KeyboardListener, resetShortcutRegistry } from './keyboard-listener';

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (_index: number) => null,
  };
}

function renderListener(store?: ReturnType<typeof createStore>) {
  const testStore = store ?? createStore();
  return render(
    <Provider store={testStore}>
      <KeyboardListener onToggleSidebar={vi.fn()} />
    </Provider>,
  );
}

describe('KeyboardListener', () => {
  beforeEach(() => {
    resetShortcutRegistry();
    vi.stubGlobal('localStorage', mockLocalStorage());
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(pointer: fine)',
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
  });

  it('opens palette on Cmd+K', async () => {
    const store = createStore();
    renderListener(store);
    await act(async () => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });
    expect(store.get(commandPaletteOpenAtom)).toBe(true);
  });

  it('opens palette on Ctrl+K', async () => {
    const store = createStore();
    renderListener(store);
    await act(async () => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });
    expect(store.get(commandPaletteOpenAtom)).toBe(true);
  });

  it('toggles palette closed on second Cmd+K', async () => {
    const store = createStore();
    store.set(commandPaletteOpenAtom, true);
    renderListener(store);
    await act(async () => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });
    expect(store.get(commandPaletteOpenAtom)).toBe(false);
  });

  it('calls Cmd+K preventDefault', async () => {
    const store = createStore();
    renderListener(store);
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    const spy = vi.spyOn(event, 'preventDefault');
    await act(async () => {
      document.dispatchEvent(event);
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
