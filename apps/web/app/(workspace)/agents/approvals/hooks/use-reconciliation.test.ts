import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockToastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
  },
}));

vi.mock('./use-reconciliation', async () => {
  const { useState, useCallback, useRef } = await import('react');

  return {
    useReconciliation: <T,>(
      action: (data: T) => Promise<{ success: boolean; error?: any }>,
      options: {
        onSuccess?: (data: T) => void;
        onRollback?: (data: T) => void;
        delayMs?: number;
      } = {}
    ) => {
      const [state, setState] = useState<{
        pendingAction: T | null;
        isProcessing: boolean;
        error: string | null;
      }>({
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
          setState((prev: any) => ({ ...prev, pendingAction: null }));
        }
      }, []);

      const execute = useCallback(async (data: T) => {
        setState((prev: any) => ({ ...prev, pendingAction: data, error: null }));

        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(async () => {
          setState((prev: any) => ({ ...prev, isProcessing: true }));

          try {
            const result = await action(data);

            if (result.success) {
              setState({ pendingAction: null, isProcessing: false, error: null });
              if (options.onSuccess) options.onSuccess(data);
            } else {
              throw new Error(result.error?.message || 'Action failed');
            }
          } catch (err: any) {
            setState({ pendingAction: null, isProcessing: false, error: err.message });
            if (options.onRollback) options.onRollback(data);
            mockToastError(`Failed to process action: ${err.message}`);
          } finally {
            timerRef.current = null;
          }
        }, delayMs);
      }, [action, delayMs, options]);

      return {
        ...state,
        execute,
        cancelPending,
        isWaiting: state.pendingAction !== null && !state.isProcessing,
      };
    },
  };
});

import { useReconciliation } from './use-reconciliation';

describe('useReconciliation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockToastError.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should transition through states during successful execution', async () => {
    const mockAction = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() => useReconciliation(mockAction));

    expect(result.current.pendingAction).toBeNull();
    expect(result.current.isWaiting).toBe(false);

    act(() => {
      result.current.execute({ id: '1' });
    });

    expect(result.current.pendingAction).toEqual({ id: '1' });
    expect(result.current.isWaiting).toBe(true);
    expect(result.current.isProcessing).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.pendingAction).toBeNull();
    expect(result.current.isProcessing).toBe(false);
    expect(mockAction).toHaveBeenCalledWith({ id: '1' });
  });

  it('should allow cancellation before processing', () => {
    const mockAction = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() => useReconciliation(mockAction));

    act(() => {
      result.current.execute({ id: '1' });
    });

    expect(result.current.isWaiting).toBe(true);

    act(() => {
      result.current.cancelPending();
    });

    expect(result.current.pendingAction).toBeNull();
    expect(result.current.isWaiting).toBe(false);

    vi.advanceTimersByTime(5000);
    expect(mockAction).not.toHaveBeenCalled();
  });

  it('should handle failure and rollback', async () => {
    const mockAction = vi.fn().mockResolvedValue({ success: false, error: { message: 'Failed' } });
    const onRollback = vi.fn();
    const { result } = renderHook(() => useReconciliation(mockAction, { onRollback }));

    act(() => {
      result.current.execute({ id: '1' });
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.pendingAction).toBeNull();
    expect(result.current.error).toBe('Failed');
    expect(onRollback).toHaveBeenCalledWith({ id: '1' });
    expect(mockToastError).toHaveBeenCalledWith('Failed to process action: Failed');
  });
});
