'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

interface UndoToastProps {
  actionLabel: string;
  onUndo: () => void;
  onConfirm: () => void;
  durationMs?: number;
  open: boolean;
  onClose: () => void;
}

export function UndoToast({
  actionLabel,
  onUndo,
  onConfirm,
  durationMs = 3000,
  open,
  onClose,
}: UndoToastProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const undoButtonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();

  const undo = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
    onUndo();
    onClose();
    if (previousFocusRef.current?.isConnected) {
      previousFocusRef.current.focus();
    }
  }, [onUndo, onClose]);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setVisible(true);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        onConfirm();
        onClose();
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
    }
    return undefined;
  }, [open, durationMs, onConfirm, onClose]);

  useEffect(() => {
    if (visible && undoButtonRef.current) {
      undoButtonRef.current.focus();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[var(--flow-z-toast)]"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-[var(--flow-color-border-primary)] bg-[var(--flow-color-bg-surface-raised)] px-4 py-3 shadow-lg',
          reducedMotion ? '' : 'animate-in slide-in-from-bottom-2',
        )}
        style={{ animationDuration: reducedMotion ? '0ms' : '150ms' }}
      >
        <span className="text-sm text-[var(--flow-color-text-primary)]">
          {actionLabel}
        </span>
        <button
          ref={undoButtonRef}
          onClick={undo}
          className="rounded bg-[var(--flow-accent-primary)] px-3 py-1 text-sm font-medium text-white hover:opacity-90 focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)]"
        >
          Undo
        </button>
      </div>
    </div>
  );
}
