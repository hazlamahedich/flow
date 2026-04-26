'use client';

import { useEffect, useRef } from 'react';
import { UNDO_COPY, AUTO_DISMISS_TOAST_MS } from '../constants/trust-copy';

interface UndoToastProps {
  visible: boolean;
  onDismiss: () => void;
}

export function UndoToast({ visible, onDismiss }: UndoToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_TOAST_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="motion-reduce:transition-none fixed bottom-6 right-6 rounded-md bg-[var(--flow-color-bg-surface-raised)] px-4 py-3 text-sm text-[var(--flow-color-text-primary)] shadow-lg"
    >
      {UNDO_COPY.success}
    </div>
  );
}
