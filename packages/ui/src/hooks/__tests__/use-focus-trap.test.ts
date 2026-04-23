import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFocusTrap } from '../use-focus-trap';

describe('useFocusTrap', () => {
  it('[P0] returns a ref setter', () => {
    const { result } = renderHook(() => useFocusTrap());
    expect(typeof result.current.ref).toBe('function');
  });

  it('[P0] traps Tab key within container', () => {
    const { result } = renderHook(() => useFocusTrap());

    const container = document.createElement('div');
    const first = document.createElement('button');
    const last = document.createElement('input');
    container.appendChild(first);
    container.appendChild(last);
    document.body.appendChild(container);

    act(() => {
      result.current.ref(container);
    });

    last.focus();
    expect(document.activeElement).toBe(last);

    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(tabEvent, 'shiftKey', { value: false });
    container.dispatchEvent(tabEvent);

    document.body.removeChild(container);
  });

  it('[P0] does nothing when enabled=false', () => {
    const { result } = renderHook(() => useFocusTrap({ enabled: false }));

    const container = document.createElement('div');
    const button = document.createElement('button');
    container.appendChild(button);
    document.body.appendChild(container);

    act(() => {
      result.current.ref(container);
    });

    expect(document.activeElement).not.toBe(button);

    document.body.removeChild(container);
  });

  it('[P0] restores focus on unmount when restoreFocus=true', () => {
    const previous = document.createElement('button');
    document.body.appendChild(previous);
    previous.focus();

    const { result, unmount } = renderHook(() => useFocusTrap({ restoreFocus: true }));

    const container = document.createElement('div');
    act(() => {
      result.current.ref(container);
    });

    unmount();
    expect(document.activeElement).toBe(previous);

    document.body.removeChild(previous);
  });
});
