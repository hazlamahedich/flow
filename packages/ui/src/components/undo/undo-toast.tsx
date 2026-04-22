'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import type { UndoActionSeverity } from '@flow/shared';

interface StickyUndoToastProps {
  actionLabel: string;
  onUndo: () => void;
  onDismiss: () => void;
  severity?: UndoActionSeverity;
  irreversible?: boolean;
  stackedCount?: number;
  durationMs?: number;
}

export function StickyUndoToast({
  actionLabel,
  onUndo,
  onDismiss,
  severity = 'whisper',
  irreversible = false,
  stackedCount,
  durationMs = 30_000,
}: StickyUndoToastProps) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const undoButtonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
    onDismiss();
    if (previousFocusRef.current?.isConnected) {
      previousFocusRef.current.focus();
    }
  }, [onDismiss]);

  const undo = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
    onUndo();
    if (previousFocusRef.current?.isConnected) {
      previousFocusRef.current.focus();
    }
  }, [onUndo]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;

    timerRef.current = setTimeout(() => {
      setVisible(false);
      onDismiss();
      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      } else {
        document.body.focus();
      }
    }, durationMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [durationMs, onDismiss]);

  useEffect(() => {
    if (visible && undoButtonRef.current) {
      undoButtonRef.current.focus();
    }
  }, [visible]);

  if (!visible) return null;

  const isCeremony = severity === 'ceremony';

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[var(--flow-z-toast)] flex justify-center',
        'pointer-events-none',
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'pointer-events-auto mx-4 mb-4 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg',
          isCeremony
            ? 'border-[var(--flow-color-border-warning,var(--flow-color-border-primary))] bg-[var(--flow-color-bg-warning-subtle,var(--flow-color-bg-surface-raised))]'
            : 'border-[var(--flow-color-border-primary)] bg-[var(--flow-color-bg-surface-raised)]',
          reducedMotion ? '' : 'animate-in slide-in-from-bottom-2',
        )}
        style={{ animationDuration: reducedMotion ? '0ms' : '300ms', animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <div className="flex flex-col gap-0.5">
          <span
            className={cn(
              'text-sm',
              isCeremony
                ? 'font-medium text-[var(--flow-color-text-warning,var(--flow-color-text-primary))]'
                : 'text-[var(--flow-color-text-primary)]',
            )}
          >
            {actionLabel}
          </span>
          {irreversible && (
            <span className="text-xs text-[var(--flow-color-text-tertiary)]">
              This action cannot be fully undone
            </span>
          )}
          {stackedCount != null && stackedCount > 1 && (
            <span className="text-xs text-[var(--flow-color-text-tertiary)]">
              {stackedCount} actions available
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!irreversible && (
            <button
              ref={undoButtonRef}
              onClick={undo}
              className={cn(
                'rounded px-3 py-1 text-sm font-medium text-white focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)]',
                isCeremony
                  ? 'bg-[var(--flow-color-bg-warning,var(--flow-accent-primary))] hover:opacity-90'
                  : 'bg-[var(--flow-accent-primary)] hover:opacity-90',
              )}
            >
              Undo
            </button>
          )}
          <button
            onClick={dismiss}
            className="rounded px-2 py-1 text-sm text-[var(--flow-color-text-tertiary)] hover:text-[var(--flow-color-text-primary)] focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)]"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
