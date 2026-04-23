import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act, screen } from '@testing-library/react';
import { Provider } from 'jotai';
import { createStore } from 'jotai/vanilla';
import { commandPaletteOpenAtom } from '@flow/shared';
import { CommandPalette } from './command-palette';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function setupJsdOMPolyfills() {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = vi.fn();
}

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

const mockSearchAction = vi.fn();

function renderPalette(store?: ReturnType<typeof createStore>) {
  const testStore = store ?? createStore();
  return render(
    <Provider store={testStore}>
      <CommandPalette
        searchAction={mockSearchAction}
        onNavigate={vi.fn()}
      />
    </Provider>,
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    setupJsdOMPolyfills();
    vi.stubGlobal('localStorage', mockLocalStorage());
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(pointer: fine)',
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    mockSearchAction.mockReset();
  });

  it('renders nothing when closed', () => {
    const store = createStore();
    const { container } = renderPalette(store);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders dialog when open', () => {
    const store = createStore();
    store.set(commandPaletteOpenAtom, true);
    const { container } = renderPalette(store);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('has aria-label="Command palette"', () => {
    const store = createStore();
    store.set(commandPaletteOpenAtom, true);
    const { container } = renderPalette(store);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-label')).toBe('Command palette');
  });

  it('has aria-modal="true"', () => {
    const store = createStore();
    store.set(commandPaletteOpenAtom, true);
    const { container } = renderPalette(store);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  it('closes on Escape', async () => {
    const store = createStore();
    store.set(commandPaletteOpenAtom, true);
    const { container } = renderPalette(store);
    await act(async () => {
      fireEvent.keyDown(container.ownerDocument, { key: 'Escape' });
    });
    expect(store.get(commandPaletteOpenAtom)).toBe(false);
  });

  it('closes on backdrop click', async () => {
    const store = createStore();
    store.set(commandPaletteOpenAtom, true);
    const { container } = renderPalette(store);
    const backdrop = container.querySelector('[data-testid="command-palette-backdrop"]');
    await act(async () => {
      fireEvent.click(backdrop!);
    });
    expect(store.get(commandPaletteOpenAtom)).toBe(false);
  });

  it('shows navigation commands by default', () => {
    const store = createStore();
    store.set(commandPaletteOpenAtom, true);
    const { getByText } = renderPalette(store);
    expect(getByText('Home')).toBeTruthy();
    expect(getByText('Clients')).toBeTruthy();
    expect(getByText('Settings')).toBeTruthy();
  });

  it('shows action commands', () => {
    const store = createStore();
    store.set(commandPaletteOpenAtom, true);
    const { getAllByText } = renderPalette(store);
    const items = getAllByText('New Client');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('renders search input placeholder when opened', () => {
    const store = createStore();
    store.set(commandPaletteOpenAtom, true);
    const { container } = renderPalette(store);
    const input = container.querySelector('input[placeholder="Type a command or search..."]');
    expect(input).not.toBeNull();
  });
});
