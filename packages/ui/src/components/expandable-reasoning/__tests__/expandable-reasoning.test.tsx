import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { ExpandableReasoning } from '../expandable-reasoning';

describe('ExpandableReasoning (UX-DR26)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders collapsed by default with "Why?" button', () => {
    render(<ExpandableReasoning reasoning="The email was categorized as urgent because..." />);

    expect(screen.getByText('Why?')).toBeDefined();
    expect(screen.queryByText('Agent Reasoning')).toBeNull();
  });

  it('expands to show reasoning on click', () => {
    render(<ExpandableReasoning reasoning="This was marked urgent due to time sensitivity." />);

    fireEvent.click(screen.getByText('Why?'));

    expect(screen.getByText('Hide reasoning')).toBeDefined();
    expect(screen.getByText('Agent Reasoning')).toBeDefined();
    expect(screen.getByText('This was marked urgent due to time sensitivity.')).toBeDefined();
  });

  it('collapses on second click', () => {
    render(<ExpandableReasoning reasoning="Some reasoning text" />);

    fireEvent.click(screen.getByText('Why?'));
    expect(screen.getByText('Hide reasoning')).toBeDefined();

    fireEvent.click(screen.getByText('Hide reasoning'));
    expect(screen.getByText('Why?')).toBeDefined();
    expect(screen.queryByText('Agent Reasoning')).toBeNull();
  });

  it('only one instance can be expanded at a time (via independent state)', () => {
    const { container } = render(
      <div>
        <ExpandableReasoning reasoning="Reason A" />
        <ExpandableReasoning reasoning="Reason B" />
      </div>
    );

    const buttons = screen.getAllByText('Why?');
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[0]!);
    expect(screen.getByText('Reason A')).toBeDefined();
    expect(screen.queryByText('Reason B')).toBeNull();

    fireEvent.click(buttons[1]!);
    expect(screen.getByText('Reason A')).toBeDefined();
    expect(screen.getByText('Reason B')).toBeDefined();
  });
});
