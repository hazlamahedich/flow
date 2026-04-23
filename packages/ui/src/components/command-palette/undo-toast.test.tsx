import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { UndoToast } from './undo-toast';

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: () => null,
  };
}

describe('UndoToast', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage());
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <UndoToast
        actionLabel="Deleted item"
        onUndo={vi.fn()}
        onConfirm={vi.fn()}
        open={false}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('renders when open', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const { getByText, unmount } = render(
      <UndoToast
        actionLabel="Deleted item"
        onUndo={vi.fn()}
        onConfirm={onConfirm}
        open={true}
        onClose={onClose}
      />,
    );
    expect(getByText('Deleted item')).toBeTruthy();
    expect(getByText('Undo')).toBeTruthy();
    unmount();
  });

  it('has aria-live="polite"', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const { container, unmount } = render(
      <UndoToast
        actionLabel="Deleted item"
        onUndo={vi.fn()}
        onConfirm={onConfirm}
        open={true}
        onClose={onClose}
      />,
    );
    const status = container.querySelector('[aria-live="polite"]');
    expect(status).not.toBeNull();
    unmount();
  });

  it('calls onUndo when undo button clicked', () => {
    const onUndo = vi.fn();
    const onClose = vi.fn();
    const { getByText } = render(
      <UndoToast
        actionLabel="Deleted item"
        onUndo={onUndo}
        onConfirm={vi.fn()}
        open={true}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByText('Undo'));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
