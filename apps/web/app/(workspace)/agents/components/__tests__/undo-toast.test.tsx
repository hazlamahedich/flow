import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { UndoToast } from '../undo-toast';

describe('UndoToast', () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('returns null when not visible', () => {
    const { container } = render(<UndoToast visible={false} onDismiss={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders toast text when visible', () => {
    render(<UndoToast visible={true} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('has aria-live="polite"', () => {
    render(<UndoToast visible={true} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });

  it('auto-dismisses after timeout', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<UndoToast visible={true} onDismiss={onDismiss} />);
    act(() => { vi.advanceTimersByTime(10_001); });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('clears timeout on unmount', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { unmount } = render(<UndoToast visible={true} onDismiss={onDismiss} />);
    unmount();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
