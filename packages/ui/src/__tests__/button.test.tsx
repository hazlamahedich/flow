import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Button } from '../components/button/button';
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
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>;
}

describe('Button', () => {
  it('renders with default variant', () => {
    const { container } = render(<Button>Click me</Button>, { wrapper });
    expect(container.querySelector('button')?.textContent).toBe('Click me');
  });

  it('renders all variants', () => {
    const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
    for (const variant of variants) {
      const { unmount, container } = render(<Button variant={variant}>{variant}</Button>, { wrapper });
      expect(container.querySelector('button')?.textContent).toBe(variant);
      unmount();
    }
  });

  it('renders all sizes', () => {
    const sizes = ['default', 'sm', 'lg', 'icon'] as const;
    for (const size of sizes) {
      const { unmount, container } = render(<Button size={size}>{size}</Button>, { wrapper });
      expect(container.querySelector('button')?.textContent).toBe(size);
      unmount();
    }
  });

  it('handles click events', () => {
    const onClick = vi.fn();
    const { container } = render(<Button onClick={onClick}>Click</Button>, { wrapper });
    fireEvent.click(container.querySelector('button')!);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled prop is set', () => {
    const { container } = render(<Button disabled>Disabled</Button>, { wrapper });
    expect(container.querySelector('button')?.disabled).toBe(true);
  });

  it('consumes token CSS vars via class', () => {
    const { container } = render(<Button>Styled</Button>, { wrapper });
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('rounded-[var(--flow-radius-md)]');
  });
});
