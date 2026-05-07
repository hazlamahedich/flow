import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { SwipeableCard } from '../swipeable-card';

expect.extend(matchers);

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    animate: vi.fn(),
  };
});

describe('SwipeableCard', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders children correctly', () => {
    render(
      <SwipeableCard onApprove={vi.fn()} onReject={vi.fn()}>
        <div data-testid="card-content">Test Content</div>
      </SwipeableCard>
    );
    expect(screen.getByTestId('card-content')).toHaveTextContent('Test Content');
  });

  it('renders approve and reject labels', () => {
    render(
      <SwipeableCard onApprove={vi.fn()} onReject={vi.fn()}>
        <div>Card Content</div>
      </SwipeableCard>
    );
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('applies disabled styles when disabled prop is true', () => {
    const { container } = render(
      <SwipeableCard onApprove={vi.fn()} onReject={vi.fn()} disabled>
        <div>Disabled Card</div>
      </SwipeableCard>
    );
    const motionDiv = container.querySelector('.cursor-not-allowed');
    expect(motionDiv).toBeInTheDocument();
    expect(motionDiv).toHaveClass('opacity-50');
  });
});
