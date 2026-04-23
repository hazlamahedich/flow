import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isMac, isWindows, getDefaultShortcuts } from '../defaults';

describe('isMac', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('returns true for Mac platform', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'MacIntel' },
      writable: true,
      configurable: true,
    });

    expect(isMac()).toBe(true);
  });

  it('returns false for Windows platform', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'Win32' },
      writable: true,
      configurable: true,
    });

    expect(isMac()).toBe(false);
  });

  it('returns false when navigator undefined', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(isMac()).toBe(false);
  });
});

describe('isWindows', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('returns true for Win platform', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'Win32' },
      writable: true,
      configurable: true,
    });

    expect(isWindows()).toBe(true);
  });

  it('returns false for Mac platform', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'MacIntel' },
      writable: true,
      configurable: true,
    });

    expect(isWindows()).toBe(false);
  });
});

describe('getDefaultShortcuts', () => {
  const originalNavigator = globalThis.navigator;
  const handlers = {
    togglePalette: vi.fn(),
    toggleShortcutOverlay: vi.fn(),
    expandSidebar: vi.fn(),
    collapseSidebar: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('returns 4 base shortcuts (palette, overlay, expand, collapse)', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'Win32' },
      writable: true,
      configurable: true,
    });

    const shortcuts = getDefaultShortcuts(handlers);

    expect(shortcuts).toHaveLength(4);
    expect(shortcuts.map((s) => s.key)).toEqual(['k', '?', ']', '[']);
  });

  it('adds undo shortcut when handler provided', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'Win32' },
      writable: true,
      configurable: true,
    });

    const shortcuts = getDefaultShortcuts({ ...handlers, undo: vi.fn() });

    expect(shortcuts.some((s) => s.key === 'z')).toBe(true);
  });

  it('does not add slash alias on Windows', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'Win32' },
      writable: true,
      configurable: true,
    });

    const shortcuts = getDefaultShortcuts(handlers);

    expect(shortcuts.some((s) => s.key === '/')).toBe(false);
  });

  it('adds slash alias on Mac', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'MacIntel' },
      writable: true,
      configurable: true,
    });

    const shortcuts = getDefaultShortcuts(handlers);

    expect(shortcuts.some((s) => s.key === '/')).toBe(true);
  });

  it('command palette guard requires meta/ctrl without alt/shift', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'MacIntel' },
      writable: true,
      configurable: true,
    });

    const shortcuts = getDefaultShortcuts(handlers);
    const palette = shortcuts.find((s) => s.key === 'k')!;
    const guard = palette.guard!;

    expect(guard({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: false } as KeyboardEvent)).toBe(true);
    expect(guard({ metaKey: false, ctrlKey: true, altKey: false, shiftKey: false } as KeyboardEvent)).toBe(true);
    expect(guard({ metaKey: true, ctrlKey: false, altKey: true, shiftKey: false } as KeyboardEvent)).toBe(false);
    expect(guard({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: true } as KeyboardEvent)).toBe(false);
  });

  it('undo guard returns false when input focused', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'MacIntel' },
      writable: true,
      configurable: true,
    });

    const undo = vi.fn();
    const shortcuts = getDefaultShortcuts({ ...handlers, undo });
    const undoShortcut = shortcuts.find((s) => s.key === 'z')!;
    const guard = undoShortcut.guard!;

    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    const evt = {
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      target: inputEl,
    } as unknown as KeyboardEvent;

    expect(guard(evt)).toBe(false);
  });
});
