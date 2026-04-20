import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, ThemeContext } from '../providers/theme-provider';
import type { Theme } from '../providers/theme-provider';
import { useContext } from 'react';

function ShowTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return <span>no-context</span>;
  return (
    <span data-testid="theme-info">
      {ctx.theme}|{ctx.resolvedTheme}
    </span>
  );
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-flow-theme-provider');
  document.documentElement.removeAttribute('data-theme');
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

describe('ThemeProvider', () => {
  it('provides defaultTheme when given', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ShowTheme />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme-info').textContent).toBe('dark|dark');
  });

  it('sets data-theme attribute on html element', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ShowTheme />
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('resolves system theme to dark when prefers-dark', () => {
    const { container } = render(
      <ThemeProvider defaultTheme="system">
        <ShowTheme />
      </ThemeProvider>,
    );
    const infos = container.querySelectorAll('[data-testid="theme-info"]');
    const last = infos[infos.length - 1]!;
    expect(last.textContent).toContain('dark');
  });

  it('setTheme is exposed in context', () => {
    let capturedSetTheme: ((t: Theme) => void) | null = null;
    function Capture() {
      const ctx = useContext(ThemeContext);
      if (ctx) capturedSetTheme = ctx.setTheme;
      return null;
    }
    render(
      <ThemeProvider defaultTheme="dark">
        <Capture />
      </ThemeProvider>,
    );
    expect(typeof capturedSetTheme).toBe('function');
  });

  it('calling setTheme changes resolvedTheme', async () => {
    function ThemeSwitcher() {
      const ctx = useContext(ThemeContext);
      if (!ctx) return null;
      return (
        <div>
          <span data-testid="current">{ctx.resolvedTheme}</span>
          <button data-testid="switch" onClick={() => ctx.setTheme('light')}>switch</button>
        </div>
      );
    }
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeSwitcher />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('current').textContent).toBe('dark');
    fireEvent.click(screen.getByTestId('switch'));
    await waitFor(() => {
      expect(screen.getByTestId('current').textContent).toBe('light');
    });
  });
});
