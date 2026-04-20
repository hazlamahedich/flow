import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../components/badge/badge';
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

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Badge</Badge>, { wrapper });
    expect(screen.getByText('Badge')).toBeTruthy();
  });

  it('renders all variants', () => {
    const variants = ['default', 'secondary', 'outline', 'success', 'warning', 'error'] as const;
    for (const variant of variants) {
      const { unmount } = render(<Badge variant={variant}>{variant}</Badge>, { wrapper });
      expect(screen.getByText(variant)).toBeTruthy();
      unmount();
    }
  });

  it('renders agent identity variants', () => {
    const agents = ['inbox', 'calendar', 'ar', 'report', 'health', 'time'] as const;
    for (const agent of agents) {
      const { unmount } = render(<Badge agent={agent}>{agent}</Badge>, { wrapper });
      const el = screen.getByText(agent);
      expect(el.className).toContain(`flow-agent-${agent}`);
      unmount();
    }
  });

  it('consumes token CSS vars', () => {
    render(<Badge>Test</Badge>, { wrapper });
    const el = screen.getByText('Test');
    expect(el.className).toContain('rounded-[var(--flow-radius-full)]');
  });
});
