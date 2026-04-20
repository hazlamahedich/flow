import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithTheme } from '@flow/test-utils';
import { Button } from '../components/button/button';

beforeEach(() => {
  document.documentElement.removeAttribute('data-flow-theme-provider');
  document.documentElement.removeAttribute('data-theme');
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

describe('Button', () => {
  it('renders with default variant', () => {
    const { container } = renderWithTheme(<Button>Click me</Button>);
    expect(container.querySelector('button')?.textContent).toBe('Click me');
  });

  it('renders all variants', () => {
    const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
    for (const variant of variants) {
      const { unmount, container } = renderWithTheme(<Button variant={variant}>{variant}</Button>);
      expect(container.querySelector('button')?.textContent).toBe(variant);
      unmount();
    }
  });

  it('renders all sizes', () => {
    const sizes = ['default', 'sm', 'lg', 'icon'] as const;
    for (const size of sizes) {
      const { unmount, container } = renderWithTheme(<Button size={size}>{size}</Button>);
      expect(container.querySelector('button')?.textContent).toBe(size);
      unmount();
    }
  });

  it('handles click events', () => {
    const onClick = vi.fn();
    const { container } = renderWithTheme(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(container.querySelector('button')!);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled prop is set', () => {
    const { container } = renderWithTheme(<Button disabled>Disabled</Button>);
    expect(container.querySelector('button')?.disabled).toBe(true);
  });

  it('consumes token CSS vars via class', () => {
    const { container } = renderWithTheme(<Button>Styled</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('rounded-[var(--flow-radius-md)]');
  });
});
