import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTriageKeyboard } from '../use-triage-keyboard';

const noop = vi.fn();
const defaultOpts = {
  itemIds: ['a', 'b', 'c'],
  onApprove: noop,
  onReject: noop,
  onBatchApprove: noop,
  onBatchReject: noop,
  onEdit: noop,
  onExpand: noop,
};

describe('useTriageKeyboard', () => {
  it('starts in navigate mode', () => {
    const { result } = renderHook(() => useTriageKeyboard(defaultOpts));
    expect(result.current.mode).toBe('navigate');
    expect(result.current.modeIndicator).toBe('Navigate');
  });

  it('ArrowDown moves focus to first item when none focused', () => {
    const { result } = renderHook(() => useTriageKeyboard(defaultOpts));
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: noop } as unknown as React.KeyboardEvent);
    });
    expect(result.current.focusedItemId).toBe('a');
  });

  it('A key calls onApprove', () => {
    const onApprove = vi.fn();
    const { result } = renderHook(() => useTriageKeyboard({ ...defaultOpts, onApprove }));
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: noop } as unknown as React.KeyboardEvent);
    });
    act(() => {
      result.current.handleKeyDown({ key: 'a', preventDefault: noop } as unknown as React.KeyboardEvent);
    });
    expect(onApprove).toHaveBeenCalledWith('a');
  });

  it('R key calls onReject', () => {
    const onReject = vi.fn();
    const { result } = renderHook(() => useTriageKeyboard({ ...defaultOpts, onReject }));
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: noop } as unknown as React.KeyboardEvent);
    });
    act(() => {
      result.current.handleKeyDown({ key: 'r', preventDefault: noop } as unknown as React.KeyboardEvent);
    });
    expect(onReject).toHaveBeenCalledWith('a');
  });

  it('E key switches to edit mode', () => {
    const { result } = renderHook(() => useTriageKeyboard(defaultOpts));
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: noop } as unknown as React.KeyboardEvent);
    });
    act(() => {
      result.current.handleKeyDown({ key: 'e', preventDefault: noop } as unknown as React.KeyboardEvent);
    });
    expect(result.current.mode).toBe('edit');
    expect(result.current.modeIndicator).toBe('Editing');
  });

  it('Escape in edit mode returns to navigate', () => {
    const { result } = renderHook(() => useTriageKeyboard(defaultOpts));
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: noop } as unknown as React.KeyboardEvent);
    });
    act(() => {
      result.current.handleKeyDown({ key: 'e', preventDefault: noop } as unknown as React.KeyboardEvent);
    });
    expect(result.current.mode).toBe('edit');
    act(() => {
      result.current.handleKeyDown({ key: 'Escape', preventDefault: noop } as unknown as React.KeyboardEvent);
    });
    expect(result.current.mode).toBe('navigate');
  });

  it('shortcuts suppressed in edit mode', () => {
    const onApprove = vi.fn();
    const { result } = renderHook(() => useTriageKeyboard({ ...defaultOpts, onApprove }));
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: noop } as unknown as React.KeyboardEvent);
    });
    act(() => {
      result.current.handleKeyDown({ key: 'e', preventDefault: noop } as unknown as React.KeyboardEvent);
    });
    act(() => {
      result.current.handleKeyDown({ key: 'a', preventDefault: noop } as unknown as React.KeyboardEvent);
    });
    expect(onApprove).not.toHaveBeenCalled();
  });

  it('wraps focus at boundaries', () => {
    const { result } = renderHook(() => useTriageKeyboard(defaultOpts));
    act(() => {
      result.current.setFocusedItemId('a');
    });
    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault: noop } as unknown as React.KeyboardEvent);
    });
    expect(result.current.focusedItemId).toBe('c');
  });
});
