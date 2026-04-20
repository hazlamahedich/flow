import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { ThemeProvider } from '@flow/tokens/providers';
import type { Theme } from '@flow/tokens/providers';
import { vi } from 'vitest';

interface RenderWithThemeOptions extends Omit<RenderOptions, 'wrapper'> {
  theme?: Theme;
}

interface RenderWithThemeResult extends RenderResult {
  rerenderTheme: (ui: ReactElement, theme?: Theme) => void;
}

function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

export function renderWithTheme(
  ui: ReactElement,
  options?: RenderWithThemeOptions,
): RenderWithThemeResult {
  const { theme = 'dark', ...renderOptions } = options ?? {};

  const localStorageMock = createLocalStorageMock();
  vi.stubGlobal('localStorage', localStorageMock);

  function Wrapper({ children }: { children: ReactNode }) {
    return <ThemeProvider defaultTheme={theme}>{children}</ThemeProvider>;
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });

  return {
    ...result,
    rerenderTheme(newUi: ReactElement, newTheme?: Theme) {
      void newTheme;
      result.rerender(newUi);
    },
  };
}
