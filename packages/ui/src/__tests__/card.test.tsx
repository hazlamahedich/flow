import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardContent } from '../components/card/card';
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

describe('Card', () => {
  it('renders with surface and elevation tokens', () => {
    render(
      <Card data-testid="card">
        <CardHeader>Header</CardHeader>
        <CardContent>Body</CardContent>
      </Card>,
      { wrapper },
    );
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-[var(--flow-bg-surface)]');
    expect(card.className).toContain('shadow-[var(--flow-shadow-sm)]');
  });

  it('renders children', () => {
    render(
      <Card>
        <CardHeader>Title</CardHeader>
        <CardContent>Content</CardContent>
      </Card>,
      { wrapper },
    );
    expect(screen.getByText('Title')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
  });
});
