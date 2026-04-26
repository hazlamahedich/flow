import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClientEmptyState } from '../client-empty-state';

describe('ClientEmptyState', () => {
  it('renders no-clients variant', () => {
    render(<ClientEmptyState variant="no-clients" />);
    expect(screen.getByText('Add your first client')).toBeTruthy();
  });

  it('renders no-results variant with reset button', () => {
    const onReset = vi.fn();
    render(<ClientEmptyState variant="no-results" onReset={onReset} />);
    expect(screen.getByText('No clients match your filters')).toBeTruthy();
    expect(screen.getByText('Clear filters')).toBeTruthy();
  });

  it('renders no-assigned variant for scoped members', () => {
    render(<ClientEmptyState variant="no-assigned" />);
    expect(screen.getByText('No clients assigned yet')).toBeTruthy();
    expect(screen.getByText(/hasn't assigned you any clients/)).toBeTruthy();
  });
});
