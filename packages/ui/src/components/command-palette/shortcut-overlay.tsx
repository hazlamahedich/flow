'use client';

import { useCallback, useEffect } from 'react';
import { useAtom } from 'jotai';
import { shortcutOverlayOpenAtom } from '@flow/shared';
import { cn } from '../../lib/utils';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

const SHORTCUT_GROUPS: Record<string, Array<{ keys: string[]; description: string; mac?: boolean; note?: string }>> = {
  Navigation: [
    { keys: ['⌘', 'K'], description: 'Open command palette', mac: true },
    { keys: ['Ctrl', 'K'], description: 'Open command palette', mac: false },
    { keys: ['/'], description: 'Open command palette', mac: true, note: 'Not available on Windows (JAWS conflict)' },
  ],
  Actions: [
    { keys: [']'], description: 'Expand sidebar', mac: true },
    { keys: ['['], description: 'Collapse sidebar', mac: true },
  ],
  Utility: [
    { keys: ['?'], description: 'Show keyboard shortcuts', mac: true },
    { keys: ['Esc'], description: 'Close overlay / dialog', mac: true },
  ],
};

export function ShortcutOverlay() {
  const [open, setOpen] = useAtom(shortcutOverlayOpenAtom);
  const { ref: trapRef } = useFocusTrap<HTMLDivElement>({ enabled: open });
  const reducedMotion = useReducedMotion();

  const handleClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  const isMacPlatform = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform ?? '');

  return (
    <div
      className="fixed inset-0 z-[var(--flow-z-overlay)]"
      role="dialog"
      aria-label="Keyboard shortcuts"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/50"
        data-testid="shortcut-overlay-backdrop"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="fixed left-1/2 top-[10%] max-h-[80vh] w-full max-w-md -translate-x-1/2 overflow-y-auto">
        <div
          ref={trapRef}
          className={cn(
            'rounded-lg border border-[var(--flow-color-border-primary)] bg-[var(--flow-color-bg-surface-raised)] p-6 shadow-xl',
            reducedMotion ? '' : 'animate-in fade-in-0 zoom-in-95',
          )}
          style={{ animationDuration: reducedMotion ? '0ms' : '150ms' }}
        >
          <h2 className="mb-4 text-lg font-semibold text-[var(--flow-color-text-primary)]">
            Keyboard Shortcuts
          </h2>
          {Object.entries(SHORTCUT_GROUPS).map(([groupName, shortcuts]) => (
            <div key={groupName} className="mb-4">
              <h3 className="mb-2 text-sm font-medium text-[var(--flow-color-text-tertiary)]">
                {groupName}
              </h3>
              <ul className="space-y-1">
                {shortcuts.map((shortcut) => {
                  const available = isMacPlatform || shortcut.mac !== false;
                  return (
                    <li
                      key={shortcut.keys.join('+')}
                      className={cn(
                        'flex items-center justify-between rounded px-2 py-1.5 text-sm',
                        !available && 'opacity-40',
                      )}
                    >
                      <span className="text-[var(--flow-color-text-primary)]">
                        {shortcut.description}
                      </span>
                      <span className="flex items-center gap-1">
                        {shortcut.keys.map((key, i) => (
                          <kbd
                            key={`${key}-${i}`}
                            className="rounded border border-[var(--flow-color-border-primary)] bg-[var(--flow-color-bg-surface-inset)] px-1.5 py-0.5 text-xs font-mono"
                          >
                            {key}
                          </kbd>
                        ))}
                        {!available && (
                          <span className="ml-1 text-xs text-[var(--flow-color-text-tertiary)]">
                            (not available in current view)
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="mt-4 border-t border-[var(--flow-color-border-primary)] pt-3 text-xs text-[var(--flow-color-text-tertiary)]">
            Press <kbd className="rounded border border-[var(--flow-color-border-primary)] px-1 font-mono">Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  );
}
