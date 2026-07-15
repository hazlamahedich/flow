'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface ReconciliationState<T> {
  pendingAction: T | null;
  isProcessing: boolean;
  error: string | null;
}

export function useReconciliation<T>(
  action: (data: T) => Promise<{ success: boolean; error?: any }>,
  options: {
    onSuccess?: (data: T) => void;
    onRollback?: (data: T) => void;
    delayMs?: number;
  } = {},
) {
  const [state, setState] = useState<ReconciliationState<T>>({
    pendingAction: null,
    isProcessing: false,
    error: null,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { delayMs = 5000 } = options;

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setState((prev) => ({ ...prev, pendingAction: null }));
    }
  }, []);

  const execute = useCallback(
    async (data: T) => {
      // 1. Set optimistic state
      setState((prev) => ({ ...prev, pendingAction: data, error: null }));

      // 2. Start delay timer
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        setState((prev) => ({ ...prev, isProcessing: true }));

        try {
          const result = await action(data);

          if (result.success) {
            setState({ pendingAction: null, isProcessing: false, error: null });
            if (options.onSuccess) options.onSuccess(data);
          } else {
            throw new Error(result.error?.message || 'Action failed');
          }
        } catch (err: any) {
          setState({
            pendingAction: null,
            isProcessing: false,
            error: err.message,
          });
          if (options.onRollback) options.onRollback(data);
          toast.error(`Failed to process action: ${err.message}`);
        } finally {
          timerRef.current = null;
        }
      }, delayMs);
    },
    [action, delayMs, options],
  );

  return {
    ...state,
    execute,
    cancelPending,
    isWaiting: state.pendingAction !== null && !state.isProcessing,
  };
}
