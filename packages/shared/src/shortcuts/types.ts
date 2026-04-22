export type ShortcutContext = 'global' | 'inbox' | 'navigation';

export type ShortcutHandler = (event: KeyboardEvent) => void;

export interface ShortcutGuard {
  (event: KeyboardEvent): boolean;
}

export interface ShortcutDefinition {
  key: string;
  action: ShortcutHandler;
  context: ShortcutContext;
  guard?: ShortcutGuard;
  description: string;
  remappable: boolean;
  platform?: 'mac' | 'windows' | 'linux' | ('mac' | 'windows' | 'linux')[];
}

export interface RegisteredShortcut extends ShortcutDefinition {
  id: string;
}

export interface ShortcutRegistry {
  register: (shortcut: ShortcutDefinition) => string;
  unregister: (id: string) => void;
  resolve: (event: KeyboardEvent) => RegisteredShortcut | undefined;
  getAll: () => RegisteredShortcut[];
  getById: (id: string) => RegisteredShortcut | undefined;
}
