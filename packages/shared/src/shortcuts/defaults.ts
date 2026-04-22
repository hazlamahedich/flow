import type { ShortcutDefinition } from './types';

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);
}

export function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Win/.test(navigator.platform ?? navigator.userAgent);
}

export function getDefaultShortcuts(handlers: {
  togglePalette: () => void;
  toggleShortcutOverlay: () => void;
  expandSidebar: () => void;
  collapseSidebar: () => void;
}): ShortcutDefinition[] {
  const shortcuts: ShortcutDefinition[] = [
    {
      key: 'k',
      context: 'global',
      action: handlers.togglePalette,
      description: 'Open command palette',
      remappable: true,
      guard: (e) => {
        return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
      },
    },
    {
      key: '?',
      context: 'global',
      action: handlers.toggleShortcutOverlay,
      description: 'Show keyboard shortcuts',
      remappable: true,
      guard: (e) => {
        return !e.metaKey && !e.ctrlKey && !e.altKey;
      },
    },
    {
      key: ']',
      context: 'global',
      action: handlers.expandSidebar,
      description: 'Expand sidebar',
      remappable: true,
      guard: (e) => {
        return !e.metaKey && !e.ctrlKey && !e.altKey;
      },
    },
    {
      key: '[',
      context: 'global',
      action: handlers.collapseSidebar,
      description: 'Collapse sidebar',
      remappable: true,
      guard: (e) => {
        return !e.metaKey && !e.ctrlKey && !e.altKey;
      },
    },
  ];

  if (!isWindows()) {
    shortcuts.push({
      key: '/',
      context: 'global',
      action: handlers.togglePalette,
      description: 'Open command palette (alias)',
      remappable: true,
      guard: (e) => {
        return !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
      },
      platform: ['mac', 'linux'],
    });
  }

  return shortcuts;
}
