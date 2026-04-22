import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createShortcutRegistry, safeHandler } from './registry';
import type { ShortcutDefinition } from './types';
import { isInputFocused, hasModifierKey, isImeComposing } from './input-guard';

function makeShortcut(overrides: Partial<ShortcutDefinition> = {}): ShortcutDefinition {
  return {
    key: 'k',
    context: 'global',
    action: vi.fn(),
    description: 'Test shortcut',
    remappable: true,
    ...overrides,
  };
}

function makeKeyboardEvent(overrides: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: 'k',
    bubbles: true,
    ...overrides,
  });
}

describe('createShortcutRegistry', () => {
  let registry: ReturnType<typeof createShortcutRegistry>;

  beforeEach(() => {
    registry = createShortcutRegistry();
  });

  describe('register', () => {
    it('registers a shortcut and returns an id', () => {
      const id = registry.register(makeShortcut());
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('registers multiple shortcuts with unique ids', () => {
      const id1 = registry.register(makeShortcut());
      const id2 = registry.register(makeShortcut({ key: 'j' }));
      expect(id1).not.toBe(id2);
    });

    it('warns on duplicate key+context in development', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      registry.register(makeShortcut({ description: 'First' }));
      registry.register(makeShortcut({ description: 'Second' }));

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('Duplicate key');

      process.env.NODE_ENV = originalEnv;
      warnSpy.mockRestore();
    });

    it('does not warn on same key different context', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      registry.register(makeShortcut({ context: 'global' }));
      registry.register(makeShortcut({ context: 'inbox' }));

      expect(warnSpy).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
      warnSpy.mockRestore();
    });
  });

  describe('unregister', () => {
    it('removes a registered shortcut', () => {
      const id = registry.register(makeShortcut());
      registry.unregister(id);
      expect(registry.getById(id)).toBeUndefined();
    });

    it('does nothing for unknown id', () => {
      expect(() => registry.unregister('unknown')).not.toThrow();
    });
  });

  describe('resolve', () => {
    it('resolves a matching shortcut by key', () => {
      const action = vi.fn();
      registry.register(makeShortcut({ key: 'k', action }));
      const result = registry.resolve(makeKeyboardEvent({ key: 'k' }));
      expect(result).toBeDefined();
      expect(result?.key).toBe('k');
    });

    it('returns undefined when no shortcut matches', () => {
      registry.register(makeShortcut({ key: 'k' }));
      const result = registry.resolve(makeKeyboardEvent({ key: 'x' }));
      expect(result).toBeUndefined();
    });

    it('respects guard returning false', () => {
      registry.register(makeShortcut({
        key: 'k',
        guard: () => false,
      }));
      const result = registry.resolve(makeKeyboardEvent({ key: 'k' }));
      expect(result).toBeUndefined();
    });

    it('respects guard returning true', () => {
      registry.register(makeShortcut({
        key: 'k',
        guard: () => true,
      }));
      const result = registry.resolve(makeKeyboardEvent({ key: 'k' }));
      expect(result).toBeDefined();
    });
  });

  describe('getAll', () => {
    it('returns all registered shortcuts', () => {
      registry.register(makeShortcut({ key: 'k' }));
      registry.register(makeShortcut({ key: 'j' }));
      expect(registry.getAll()).toHaveLength(2);
    });
  });

  describe('getById', () => {
    it('returns the shortcut by id', () => {
      const id = registry.register(makeShortcut());
      expect(registry.getById(id)).toBeDefined();
      expect(registry.getById(id)?.id).toBe(id);
    });

    it('returns undefined for unknown id', () => {
      expect(registry.getById('unknown')).toBeUndefined();
    });
  });
});

describe('safeHandler', () => {
  it('calls the handler normally', () => {
    const handler = vi.fn();
    const safe = safeHandler(handler, 'test');
    const event = makeKeyboardEvent();
    safe(event);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('catches handler errors and logs them', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = vi.fn(() => {
      throw new Error('test error');
    });
    const safe = safeHandler(handler, 'test');
    safe(makeKeyboardEvent());
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});

describe('isInputFocused', () => {
  it('returns false for non-HTMLElement target', () => {
    expect(isInputFocused(null)).toBe(false);
  });

  it('returns true for <textarea>', () => {
    const el = document.createElement('textarea');
    expect(isInputFocused(el)).toBe(true);
  });

  it('returns true for <input type="text">', () => {
    const el = document.createElement('input');
    el.type = 'text';
    expect(isInputFocused(el)).toBe(true);
  });

  it('returns true for <input type="search">', () => {
    const el = document.createElement('input');
    el.type = 'search';
    expect(isInputFocused(el)).toBe(true);
  });

  it('returns true for <input type="email">', () => {
    const el = document.createElement('input');
    el.type = 'email';
    expect(isInputFocused(el)).toBe(true);
  });

  it('returns false for <input type="checkbox">', () => {
    const el = document.createElement('input');
    el.type = 'checkbox';
    expect(isInputFocused(el)).toBe(false);
  });

  it('returns false for <input type="radio">', () => {
    const el = document.createElement('input');
    el.type = 'radio';
    expect(isInputFocused(el)).toBe(false);
  });

  it('returns false for <input type="range">', () => {
    const el = document.createElement('input');
    el.type = 'range';
    expect(isInputFocused(el)).toBe(false);
  });

  it('returns false for <input type="submit">', () => {
    const el = document.createElement('input');
    el.type = 'submit';
    expect(isInputFocused(el)).toBe(false);
  });

  it('returns true for contentEditable element', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    expect(isInputFocused(el)).toBe(true);
  });

  it('returns true for element with contenteditable="true" attribute', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    expect(isInputFocused(el)).toBe(true);
  });

  it('returns false for regular div', () => {
    const el = document.createElement('div');
    expect(isInputFocused(el)).toBe(false);
  });
});

describe('hasModifierKey', () => {
  it('returns true for metaKey', () => {
    const e = makeKeyboardEvent({ metaKey: true });
    expect(hasModifierKey(e)).toBe(true);
  });

  it('returns true for ctrlKey', () => {
    const e = makeKeyboardEvent({ ctrlKey: true });
    expect(hasModifierKey(e)).toBe(true);
  });

  it('returns true for altKey', () => {
    const e = makeKeyboardEvent({ altKey: true });
    expect(hasModifierKey(e)).toBe(true);
  });

  it('returns false with no modifiers', () => {
    const e = makeKeyboardEvent();
    expect(hasModifierKey(e)).toBe(false);
  });
});

describe('isImeComposing', () => {
  it('returns true when isComposing is true', () => {
    const e = new KeyboardEvent('keydown', { key: 'a', bubbles: true } as KeyboardEventInit);
    Object.defineProperty(e, 'isComposing', { value: true });
    expect(isImeComposing(e)).toBe(true);
  });

  it('returns false when isComposing is false', () => {
    const e = makeKeyboardEvent();
    expect(isImeComposing(e)).toBe(false);
  });
});
