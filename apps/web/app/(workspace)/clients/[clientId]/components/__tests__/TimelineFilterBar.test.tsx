import { render, screen, fireEvent, cleanup } from '@flow/test-utils';
import { TimelineFilterBar } from '../TimelineFilterBar';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useQueryState } from 'nuqs';

vi.mock('nuqs', () => ({
  useQueryState: vi.fn(),
}));

describe('TimelineFilterBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with default "All" type and "Last 90 Days" range', () => {
    (useQueryState as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'type') return ['all', vi.fn()];
      if (key === 'range') return ['90d', vi.fn()];
      return [null, vi.fn()];
    });

    render(<TimelineFilterBar />);

    expect(screen.getByText('Communication Timeline')).toBeDefined();
    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByRole('combobox')).toHaveProperty('value', '90d');
  });

  it('pushes type=emails to URL when Emails button clicked', () => {
    const setType = vi.fn();
    (useQueryState as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'type') return ['all', setType];
      if (key === 'range') return ['90d', vi.fn()];
      return [null, vi.fn()];
    });

    render(<TimelineFilterBar />);
    fireEvent.click(screen.getByText('Emails'));

    expect(setType).toHaveBeenCalledWith('emails');
  });

  it('pushes range=7d to URL when 7d option selected', () => {
    const setRange = vi.fn();
    (useQueryState as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'type') return ['all', vi.fn()];
      if (key === 'range') return ['90d', setRange];
      return [null, vi.fn()];
    });

    render(<TimelineFilterBar />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '7d' } });

    expect(setRange).toHaveBeenCalledWith('7d');
  });

  it('renders deep-linked agent_runs and 7d without empty flash', () => {
    (useQueryState as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'type') return ['agent_runs', vi.fn()];
      if (key === 'range') return ['7d', vi.fn()];
      return [null, vi.fn()];
    });

    render(<TimelineFilterBar />);

    expect(screen.getByRole('combobox')).toHaveProperty('value', '7d');
    expect(screen.getByText('Agent Actions')).toBeDefined();
  });

  it('includes all date range options', () => {
    (useQueryState as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'type') return ['all', vi.fn()];
      if (key === 'range') return ['90d', vi.fn()];
      return [null, vi.fn()];
    });

    render(<TimelineFilterBar />);
    const select = screen.getByRole('combobox');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);

    expect(options).toContain('7d');
    expect(options).toContain('30d');
    expect(options).toContain('90d');
    expect(options).toContain('all');
  });
});
