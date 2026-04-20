import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '../components/input/input';
import { ThemeProvider } from '@flow/tokens/providers';

beforeEach(() => {
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => Object.keys(store).forEach((k) => { delete store[k]; }),
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  });
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>;
}

describe('Input', () => {
  it('renders with border and ring tokens', () => {
    render(<Input data-testid="input" />, { wrapper });
    const input = screen.getByTestId('input');
    expect(input.className).toContain('border-[var(--flow-border-default)]');
    expect(input.className).toContain('ring-[var(--flow-focus-ring-color)]');
  });

  it('renders with placeholder using muted text token', () => {
    render(<Input placeholder="Enter value" />, { wrapper });
    const input = screen.getByPlaceholderText('Enter value');
    expect(input).toBeTruthy();
    expect(input.className).toContain('placeholder:text-[var(--flow-text-muted)]');
  });

  it('supports disabled state', () => {
    const { container } = render(<Input disabled data-testid="input" />, { wrapper });
    expect(container.querySelector('input')?.disabled).toBe(true);
  });
});
