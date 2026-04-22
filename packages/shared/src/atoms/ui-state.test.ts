import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStore } from 'jotai/vanilla';
import { sidebarCollapsedAtom, sidebarHoverExpandedAtom } from './ui-state';

function createLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((_index: number) => null),
  } as unknown as Storage;
}

describe('sidebarCollapsedAtom', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it('defaults to false', () => {
    expect(store.get(sidebarCollapsedAtom)).toBe(false);
  });

  it('toggles to true', () => {
    store.set(sidebarCollapsedAtom, true);
    expect(store.get(sidebarCollapsedAtom)).toBe(true);
  });

  it('toggles back to false', () => {
    store.set(sidebarCollapsedAtom, true);
    store.set(sidebarCollapsedAtom, false);
    expect(store.get(sidebarCollapsedAtom)).toBe(false);
  });
});

describe('sidebarHoverExpandedAtom', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it('defaults to false', () => {
    expect(store.get(sidebarHoverExpandedAtom)).toBe(false);
  });

  it('toggles to true', () => {
    store.set(sidebarHoverExpandedAtom, true);
    expect(store.get(sidebarHoverExpandedAtom)).toBe(true);
  });
});

describe('SSR safety', () => {
  it('sidebarCollapsedAtom returns false when localStorage is unavailable', () => {
    const freshStore = createStore();
    expect(freshStore.get(sidebarCollapsedAtom)).toBe(false);
  });

  it('sidebarCollapsedAtom persists via localStorage when window is available', () => {
    const ls = createLocalStorage();
    const originalWindow = globalThis.window;
    const originalLS = globalThis.localStorage;
    try {
      (globalThis as Record<string, unknown>).window = { localStorage: ls };
      (globalThis as Record<string, unknown>).localStorage = ls;
      const freshStore = createStore();
      freshStore.set(sidebarCollapsedAtom, true);
      expect(ls.setItem).toHaveBeenCalledWith('flow-sidebar-collapsed', 'true');
    } finally {
      (globalThis as Record<string, unknown>).window = originalWindow;
      (globalThis as Record<string, unknown>).localStorage = originalLS;
    }
  });
});
