import { useCallback, useRef } from 'react';

export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delayMs: number,
): T & { cancel: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debounced = useCallback(
    ((...args: unknown[]) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      timerRef.current = setTimeout(() => {
        if (!controller.signal.aborted) {
          callbackRef.current(...args);
        }
      }, delayMs);
    }) as T & { cancel: () => void },
    [delayMs],
  );

  debounced.cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  return debounced;
}
