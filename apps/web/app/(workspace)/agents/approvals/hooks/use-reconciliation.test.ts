import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReconciliation } from './use-reconciliation';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('useReconciliation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

    // Advance time by 5s
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.isProcessing).toBe(true);
    
    // Wait for action to complete
    await act(async () => {
      await Promise.resolve(); // Allow action promise to resolve
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
    expect(toast.error).toHaveBeenCalledWith('Failed to process action: Failed');
  });
});
