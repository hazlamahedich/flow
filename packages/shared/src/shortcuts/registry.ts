import type {
  ShortcutDefinition,
  ShortcutRegistry,
  RegisteredShortcut,
} from './types';

let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `shortcut-${idCounter}`;
}

export function createShortcutRegistry(): ShortcutRegistry {
  const shortcuts = new Map<string, RegisteredShortcut>();

  const register = (shortcut: ShortcutDefinition): string => {
    const id = nextId();
    const registered: RegisteredShortcut = { ...shortcut, id };

    for (const [, existing] of shortcuts) {
      if (
        existing.key === shortcut.key &&
        existing.context === shortcut.context
      ) {
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
          console.warn(
            `[ShortcutRegistry] Duplicate key "${shortcut.key}" in context "${shortcut.context}". ` +
            `Existing: "${existing.description}", New: "${shortcut.description}".`,
          );
        }
      }
    }

    shortcuts.set(id, registered);
    return id;
  };

  const unregister = (id: string): void => {
    shortcuts.delete(id);
  };

  const resolve = (event: KeyboardEvent): RegisteredShortcut | undefined => {
    for (const [, shortcut] of shortcuts) {
      if (shortcut.key !== event.key) continue;

      if (shortcut.guard && !shortcut.guard(event)) continue;

      return shortcut;
    }
    return undefined;
  };

  const getAll = (): RegisteredShortcut[] => {
    return Array.from(shortcuts.values());
  };

  const getById = (id: string): RegisteredShortcut | undefined => {
    return shortcuts.get(id);
  };

  return { register, unregister, resolve, getAll, getById };
}

export function safeHandler(
  handler: (event: KeyboardEvent) => void,
  context: string,
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    try {
      handler(event);
    } catch (error) {
      console.error(
        `[ShortcutRegistry] Error in handler for context "${context}":`,
        error,
      );
    }
  };
}
