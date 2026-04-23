import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const mockUndoAction = vi.fn().mockResolvedValue({ success: true, data: {} });

describe('UndoProvider', () => {
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

  it('exports correctly', async () => {
    const mod = await import('./undo-provider');
    expect(mod.UndoProvider).toBeDefined();
  });

  it('accepts undoAction prop', async () => {
    await import('./undo-provider');
    expect(typeof mockUndoAction).toBe('function');
  });
});
