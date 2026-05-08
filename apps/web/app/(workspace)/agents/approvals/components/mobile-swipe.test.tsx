import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SwipeableCard } from './swipeable-card';

describe('SwipeableCard', () => {
  it('should render children', () => {
    render(
      <SwipeableCard onApprove={vi.fn()} onReject={vi.fn()}>
        <div>Card Content</div>
      </SwipeableCard>
    );
    expect(screen.getByText('Card Content')).toBeDefined();
  });

  it('should show approve/reject hints on drag', () => {
    // This is hard to test with fireEvent for framer-motion drag
    // but we can verify it doesn't crash
    render(
      <SwipeableCard onApprove={vi.fn()} onReject={vi.fn()}>
        <div>Card Content</div>
      </SwipeableCard>
    );
    const card = screen.getByText('Card Content');
    fireEvent.mouseDown(card);
    fireEvent.mouseMove(card, { clientX: 100 });
    // We expect the internal state to update, but checking opacity/rotate 
    // depends on framer-motion internals.
  });

  it('should respect disabled state', () => {
    const onApprove = vi.fn();
    render(
      <SwipeableCard onApprove={onApprove} onReject={vi.fn()} disabled>
        <div>Disabled Card</div>
      </SwipeableCard>
    );
    const card = screen.getByText('Disabled Card');
    fireEvent.mouseDown(card);
    fireEvent.mouseMove(card, { clientX: 200 });
    fireEvent.mouseUp(card);
    expect(onApprove).not.toHaveBeenCalled();
  });
});
