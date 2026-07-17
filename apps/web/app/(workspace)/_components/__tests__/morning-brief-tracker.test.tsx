import { render, cleanup } from '@flow/test-utils';
import { MorningBriefTracker } from '../morning-brief-tracker';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

const mockMarkBriefViewed = vi.fn().mockResolvedValue({ success: true });

vi.mock('../../actions/morning-brief', () => ({
  markBriefViewed: (...args: any[]) => mockMarkBriefViewed(...args),
}));

describe('MorningBriefTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('calls markBriefViewed once on mount', () => {
    render(
      <MorningBriefTracker briefId="00000000-0000-0000-0000-000000000001" />,
    );
    expect(mockMarkBriefViewed).toHaveBeenCalledTimes(1);
    expect(mockMarkBriefViewed).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
    );
  });

  it('renders nothing', () => {
    const { container } = render(
      <MorningBriefTracker briefId="00000000-0000-0000-0000-000000000001" />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('does not fire again on re-render', () => {
    const { rerender } = render(
      <MorningBriefTracker briefId="00000000-0000-0000-0000-000000000001" />,
    );
    expect(mockMarkBriefViewed).toHaveBeenCalledTimes(1);

    rerender(
      <MorningBriefTracker briefId="00000000-0000-0000-0000-000000000001" />,
    );
    expect(mockMarkBriefViewed).toHaveBeenCalledTimes(1);
  });

  it('handles markBriefViewed rejection gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockMarkBriefViewed.mockRejectedValueOnce(new Error('Network error'));

    render(
      <MorningBriefTracker briefId="00000000-0000-0000-0000-000000000001" />,
    );

    expect(mockMarkBriefViewed).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });
});
