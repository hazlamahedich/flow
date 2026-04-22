import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ConflictDialog } from './conflict-dialog';

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (_index: number) => null,
  };
}

describe('ConflictDialog', () => {
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

  const baseConflict = {
    hasConflict: true,
    conflictingFields: [
      { fieldName: 'name', fieldLabel: 'Client Name', clientValue: 'Alice', serverValue: 'Bob' },
    ],
    autoMergedFields: [],
  };

  it('renders plain language labels', () => {
    const { getByText } = render(
      <ConflictDialog conflictInfo={baseConflict} onResolve={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(getByText('Your changes')).toBeTruthy();
    expect(getByText('Current version')).toBeTruthy();
  });

  it('shows field description in plain language', () => {
    const { getAllByText } = render(
      <ConflictDialog conflictInfo={baseConflict} onResolve={vi.fn()} onDismiss={vi.fn()} />,
    );
    const matches = getAllByText(/You changed/);
    expect(matches.length).toBeGreaterThan(0);
    expect(getAllByText(/Client Name/).length).toBeGreaterThan(0);
  });

  it('shows Keep yours and Keep current buttons', () => {
    const { getAllByText } = render(
      <ConflictDialog conflictInfo={baseConflict} onResolve={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(getAllByText('Keep yours').length).toBeGreaterThan(0);
    expect(getAllByText('Keep current').length).toBeGreaterThan(0);
  });

  it('shows auto-merged fields', () => {
    const conflict = {
      hasConflict: true,
      conflictingFields: baseConflict.conflictingFields,
      autoMergedFields: [
        { fieldName: 'email', fieldLabel: 'Email Address', value: 'alice@test.com', source: 'client' as const },
      ],
    };
    const { getByText } = render(
      <ConflictDialog conflictInfo={conflict} onResolve={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(getByText('These changes will be kept:')).toBeTruthy();
    expect(getByText('Email Address')).toBeTruthy();
  });

  it('calls onDismiss when Cancel clicked', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <ConflictDialog conflictInfo={baseConflict} onResolve={vi.fn()} onDismiss={onDismiss} />,
    );
    const buttons = container.querySelectorAll('button');
    const cancelButton = Array.from(buttons).find((b) => b.textContent === 'Cancel');
    expect(cancelButton).toBeTruthy();
    if (cancelButton) {
      fireEvent.click(cancelButton);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    }
  });

  it('has dialog ARIA attributes', () => {
    const { container } = render(
      <ConflictDialog conflictInfo={baseConflict} onResolve={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.querySelector('[aria-modal="true"]')).toBeTruthy();
  });
});
