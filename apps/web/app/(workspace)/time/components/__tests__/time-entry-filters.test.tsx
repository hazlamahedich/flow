import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TimeEntryFilters } from '../time-entry-filters';

const clients = [
  { id: 'c-1', name: 'Acme Corp' },
  { id: 'c-2', name: 'Beta LLC' },
];
const members = [
  { userId: 'u-1', displayName: 'Alice', role: 'member' },
  { userId: 'u-2', displayName: 'Bob', role: 'member' },
];
const projects = [
  { id: 'p-1', name: 'Project Alpha' },
  { id: 'p-2', name: 'Project Beta' },
];

const defaultProps = {
  clients,
  members,
  role: 'owner' as const,
  filterClient: '',
  filterProject: '',
  filterProjects: projects,
  filterDateFrom: '',
  filterDateTo: '',
  filterMember: '',
  loading: false,
  onClientChange: vi.fn(),
  onProjectChange: vi.fn(),
  onDateFromChange: vi.fn(),
  onDateToChange: vi.fn(),
  onMemberChange: vi.fn(),
  onApply: vi.fn(),
  onClear: vi.fn(),
};

afterEach(() => { cleanup(); });
beforeEach(() => { vi.clearAllMocks(); });

describe('TimeEntryFilters', () => {
  it('[P1] renders all filter controls', () => {
    render(<TimeEntryFilters {...defaultProps} />);
    expect(screen.getByText('All Clients')).toBeInTheDocument();
    expect(screen.getByText('All Projects')).toBeInTheDocument();
    expect(screen.getByText('All Members')).toBeInTheDocument();
    expect(screen.getByText('Filter')).toBeInTheDocument();
  });

  it('[P1] calls onClientChange when client selected', () => {
    render(<TimeEntryFilters {...defaultProps} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0]!, { target: { value: 'c-1' } });
    expect(defaultProps.onClientChange).toHaveBeenCalledWith('c-1');
  });

  it('[P1] calls onProjectChange when project selected', () => {
    render(<TimeEntryFilters {...defaultProps} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1]!, { target: { value: 'p-1' } });
    expect(defaultProps.onProjectChange).toHaveBeenCalledWith('p-1');
  });

  it('[P1] calls onApply when Filter button clicked', () => {
    render(<TimeEntryFilters {...defaultProps} />);
    const filterBtns = screen.getAllByRole('button', { name: 'Filter' });
    fireEvent.click(filterBtns[0]!);
    expect(defaultProps.onApply).toHaveBeenCalled();
  });

  it('[P1] shows Clear filters only when filters active', () => {
    const { rerender } = render(<TimeEntryFilters {...defaultProps} />);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();

    rerender(<TimeEntryFilters {...defaultProps} filterClient="c-1" />);
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('[P1] calls onClear when Clear filters clicked', () => {
    render(<TimeEntryFilters {...defaultProps} filterClient="c-1" />);
    const clearBtns = screen.getAllByRole('button', { name: 'Clear filters' });
    fireEvent.click(clearBtns[0]!);
    expect(defaultProps.onClear).toHaveBeenCalled();
  });

  it('[P1] hides member filter for member role', () => {
    render(<TimeEntryFilters {...defaultProps} role="member" />);
    expect(screen.queryByText('All Members')).not.toBeInTheDocument();
  });

  it('[P1] disables project select when no client selected', () => {
    render(<TimeEntryFilters {...defaultProps} filterClient="" />);
    const selects = screen.getAllByRole('combobox');
    expect(selects[1]).toBeDisabled();
  });

  it('[P1] calls date handlers on date input change', () => {
    render(<TimeEntryFilters {...defaultProps} />);
    const dateInputs = screen.getAllByDisplayValue('');
    const dateFrom = dateInputs.find((el) => el.getAttribute('type') === 'date' && el.getAttribute('value') === '');
    const allDateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(allDateInputs[0]!, { target: { value: '2026-05-01' } });
    expect(defaultProps.onDateFromChange).toHaveBeenCalledWith('2026-05-01');
    fireEvent.change(allDateInputs[1]!, { target: { value: '2026-05-10' } });
    expect(defaultProps.onDateToChange).toHaveBeenCalledWith('2026-05-10');
  });

  it('[P1] disables Filter button when loading', () => {
    render(<TimeEntryFilters {...defaultProps} loading={true} />);
    const loadingBtns = screen.getAllByRole('button', { name: '...' });
    expect(loadingBtns[0]).toBeDisabled();
  });
});
