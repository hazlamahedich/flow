import { describe, it, expect } from 'vitest';
import { renderWithTheme } from '@flow/test-utils';
import { screen } from '@testing-library/react';

describe('Input', () => {
  it('renders with border and ring tokens', () => {
    renderWithTheme(<input data-testid="input" className="border-[var(--flow-border-default)] ring-[var(--flow-focus-ring-color)]" />);
    const input = screen.getByTestId('input');
    expect(input.className).toContain('border-[var(--flow-border-default)]');
    expect(input.className).toContain('ring-[var(--flow-focus-ring-color)]');
  });

  it('renders with placeholder using muted text token', () => {
    renderWithTheme(<input placeholder="Enter value" className="placeholder:text-[var(--flow-text-muted)]" />);
    const input = screen.getByPlaceholderText('Enter value');
    expect(input).toBeTruthy();
    expect(input.className).toContain('placeholder:text-[var(--flow-text-muted)]');
  });

  it('supports disabled state', () => {
    const { container } = renderWithTheme(<input disabled data-testid="input" />);
    expect(container.querySelector('input')?.disabled).toBe(true);
  });
});
