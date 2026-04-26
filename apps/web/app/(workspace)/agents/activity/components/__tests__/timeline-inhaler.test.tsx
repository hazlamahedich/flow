import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TimelineInhaler } from '../timeline-inhaler';

describe('TimelineInhaler', () => {
  afterEach(() => cleanup());

  it('renders summary text when no filters active', () => {
    const { container } = render(<TimelineInhaler totalCount={100} filteredCount={25} filters={{}} />);
    expect(container.querySelector('[aria-live="polite"]')).toBeDefined();
    expect(container.textContent).toContain('25');
  });

  it('renders filtered text when filters active', () => {
    const { container } = render(<TimelineInhaler totalCount={100} filteredCount={10} filters={{ agentId: 'inbox' }} />);
    expect(container.querySelector('[aria-live="polite"]')).toBeDefined();
    expect(container.textContent).toContain('10 of 100');
  });

  it('has aria-live="polite"', () => {
    const { container } = render(<TimelineInhaler totalCount={50} filteredCount={50} filters={{}} />);
    const el = container.querySelector('[aria-live="polite"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-live')).toBe('polite');
  });
});
