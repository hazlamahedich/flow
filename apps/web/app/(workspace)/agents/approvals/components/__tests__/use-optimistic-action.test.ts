import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOptimisticAction } from '../use-optimistic-action';

describe('useOptimisticAction', () => {
  it('confirms state on server success', async () => {
    const actionFn = vi.fn().mockResolvedValue({ success: true });
    const onError = vi.fn();
    const items = [{ runId: 'r1', status: 'waiting_approval' as const }];

    const { result } = renderHook(() =>
      useOptimisticAction({ items, actionFn, onError }),
    );

    await act(async () => {
      await result.current.execute('r1', 'completed');
    });

    expect(actionFn).toHaveBeenCalledWith('r1');
    expect(onError).not.toHaveBeenCalled();
  });

  it('rollback + error on server failure', async () => {
    const actionFn = vi.fn().mockResolvedValue({
      success: false,
      error: { message: 'Conflict' },
    });
    const onError = vi.fn();
    const items = [{ runId: 'r1', status: 'waiting_approval' as const }];

    const { result } = renderHook(() =>
      useOptimisticAction({ items, actionFn, onError }),
    );

    await act(async () => {
      await result.current.execute('r1', 'completed');
    });

    expect(onError).toHaveBeenCalledWith('r1', 'Conflict');
  });

  it('rollback on network error', async () => {
    const actionFn = vi.fn().mockRejectedValue(new Error('timeout'));
    const onError = vi.fn();
    const items = [{ runId: 'r1', status: 'waiting_approval' as const }];

    const { result } = renderHook(() =>
      useOptimisticAction({ items, actionFn, onError }),
    );

    await act(async () => {
      await result.current.execute('r1', 'completed');
    });

    expect(onError).toHaveBeenCalledWith('r1', 'Network error');
  });
});
