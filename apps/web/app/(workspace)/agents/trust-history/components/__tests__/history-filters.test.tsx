import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HistoryFilters } from '../history-filters';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('HistoryFilters', () => {
  afterEach(() => cleanup());

  it('renders agent filter dropdown', () => {
    render(<HistoryFilters currentAgent={undefined} currentDirection={undefined} currentDateFrom={undefined} currentDateTo={undefined} />);
    expect(screen.getByLabelText(/agent/i)).toBeDefined();
  });

  it('renders direction filter dropdown', () => {
    render(<HistoryFilters currentAgent={undefined} currentDirection={undefined} currentDateFrom={undefined} currentDateTo={undefined} />);
    expect(screen.getByLabelText(/direction/i)).toBeDefined();
  });

  it('renders date from input', () => {
    render(<HistoryFilters currentAgent={undefined} currentDirection={undefined} currentDateFrom={undefined} currentDateTo={undefined} />);
    expect(screen.getByLabelText(/from/i)).toBeDefined();
  });

  it('renders date to input', () => {
    render(<HistoryFilters currentAgent={undefined} currentDirection={undefined} currentDateFrom={undefined} currentDateTo={undefined} />);
    expect(document.getElementById('filter-to')).toBeDefined();
  });

  it('renders clear button', () => {
    render(<HistoryFilters currentAgent={undefined} currentDirection={undefined} currentDateFrom={undefined} currentDateTo={undefined} />);
    expect(screen.getByTestId('history-filters')).toBeDefined();
  });

  it('has toolbar role', () => {
    render(<HistoryFilters currentAgent={undefined} currentDirection={undefined} currentDateFrom={undefined} currentDateTo={undefined} />);
    expect(screen.getByRole('toolbar', { name: /filter trust history/i })).toBeDefined();
  });
});
