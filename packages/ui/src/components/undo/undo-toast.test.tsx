import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { StickyUndoToast } from './undo-toast';

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

describe('StickyUndoToast', () => {
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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders action label', () => {
    const { getByText, unmount } = render(
      <StickyUndoToast
        actionLabel="Updated client name"
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(getByText('Updated client name')).toBeTruthy();
    unmount();
  });

  it('has aria-live="polite"', () => {
    const { container, unmount } = render(
      <StickyUndoToast
        actionLabel="Test"
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const status = container.querySelector('[aria-live="polite"]');
    expect(status).not.toBeNull();
    unmount();
  });

  it('calls onUndo when undo clicked', () => {
    const onUndo = vi.fn();
    const { getByText } = render(
      <StickyUndoToast
        actionLabel="Test"
        onUndo={onUndo}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(getByText('Undo'));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('shows ceremony styling for destructive actions', () => {
    const { container, unmount } = render(
      <StickyUndoToast
        actionLabel="Deleted client"
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
        severity="ceremony"
      />,
    );
    expect(container.textContent).toContain('Deleted client');
    unmount();
  });

  it('shows irreversible label when irreversible', () => {
    const { getByText, unmount } = render(
      <StickyUndoToast
        actionLabel="Archived client"
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
        irreversible={true}
      />,
    );
    expect(getByText('This action cannot be fully undone')).toBeTruthy();
    unmount();
  });

  it('hides undo button when irreversible', () => {
    const { container, unmount } = render(
      <StickyUndoToast
        actionLabel="Archived client"
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
        irreversible={true}
      />,
    );
    const undoButtons = container.querySelectorAll('button');
    const hasUndo = Array.from(undoButtons).some((b) => b.textContent === 'Undo');
    expect(hasUndo).toBe(false);
    unmount();
  });

  it('shows stacked count when provided', () => {
    const { getByText, unmount } = render(
      <StickyUndoToast
        actionLabel="Test"
        onUndo={vi.fn()}
        onDismiss={vi.fn()}
        stackedCount={3}
      />,
    );
    expect(getByText('3 actions available')).toBeTruthy();
    unmount();
  });
});
