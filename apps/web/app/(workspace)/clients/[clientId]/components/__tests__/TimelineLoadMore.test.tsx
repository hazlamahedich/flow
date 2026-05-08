import { render, screen, fireEvent, cleanup } from '@flow/test-utils';
import { TimelineLoadMore } from '../TimelineLoadMore';
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('TimelineLoadMore', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders button when hasMore is true', () => {
    render(<TimelineLoadMore onLoadMore={vi.fn()} isLoading={false} hasMore={true} />);
    expect(screen.getByText('Load More')).toBeDefined();
  });

  it('returns null when hasMore is false', () => {
    const { container } = render(<TimelineLoadMore onLoadMore={vi.fn()} isLoading={false} hasMore={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onLoadMore when clicked', () => {
    const onLoadMore = vi.fn();
    render(<TimelineLoadMore onLoadMore={onLoadMore} isLoading={false} hasMore={true} />);

    fireEvent.click(screen.getByText('Load More'));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('shows loading state during fetch', () => {
    render(<TimelineLoadMore onLoadMore={vi.fn()} isLoading={true} hasMore={true} />);

    expect(screen.getByText('Loading...')).toBeDefined();
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
