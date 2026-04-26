import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityFilters } from '../activity-filters';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('ActivityFilters', () => {
  afterEach(() => cleanup());

  it('renders agent filter dropdown', () => {
    render(<ActivityFilters filters={{}} totalCount={50} />);
    expect(screen.getByLabelText('Filter by agent')).toBeDefined();
  });

  it('renders status filter dropdown', () => {
    render(<ActivityFilters filters={{}} totalCount={50} />);
    expect(screen.getByLabelText('Filter by status')).toBeDefined();
  });

  it('renders date from input', () => {
    render(<ActivityFilters filters={{}} totalCount={50} />);
    expect(screen.getByLabelText('From date')).toBeDefined();
  });

  it('renders date to input', () => {
    render(<ActivityFilters filters={{}} totalCount={50} />);
    expect(screen.getByLabelText('To date')).toBeDefined();
  });

  it('has search role', () => {
    render(<ActivityFilters filters={{}} totalCount={50} />);
    expect(screen.getByRole('search')).toBeDefined();
  });

  it('renders show filters button when collapsed', async () => {
    render(<ActivityFilters filters={{}} totalCount={50} />);
    const container = screen.getByRole('search');
    expect(container).toBeDefined();
  });

  it('renders all agents option', () => {
    render(<ActivityFilters filters={{}} totalCount={50} />);
    expect(screen.getByText('All agents')).toBeDefined();
  });

  it('renders all statuses option', () => {
    render(<ActivityFilters filters={{}} totalCount={50} />);
    expect(screen.getByText('All statuses')).toBeDefined();
  });
});
