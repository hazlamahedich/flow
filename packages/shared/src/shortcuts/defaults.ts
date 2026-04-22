import type { ShortcutDefinition } from './types';
import { isInputFocused } from './input-guard';
import { isBlockNoteFocused } from './blocknote-guard';

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
  undo?: () => void;
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

  if (handlers.undo) {
    shortcuts.push({
      key: 'z',
      context: 'global',
      action: handlers.undo,
      description: 'Undo last action',
      remappable: false,
      guard: (e) => {
        if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return false;
        if (isInputFocused(e.target) || isBlockNoteFocused(e.target)) return false;
        return true;
      },
    });
  }

  return shortcuts;
}
