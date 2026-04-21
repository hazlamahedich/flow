'use client';

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'flow-theme';
const PROVIDER_ATTR = 'data-flow-theme-provider';

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function getSystemPreference(): ResolvedTheme {
  if (!hasMatchMedia()) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemPreference() : theme;
}

function safeGetStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage may be unavailable in SSR or sandboxed contexts
  }
}

function readStoredTheme(): Theme {
  const stored = safeGetStorage(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function applyThemeToRoot(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme }: ThemeProviderProps) {
  const mounted = useRef(false);

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme ?? 'system';
    const stored = readStoredTheme();
    return stored !== 'system' ? stored : (defaultTheme ?? 'system');
  });

  useEffect(() => {
    if (document.documentElement.hasAttribute(PROVIDER_ATTR)) {
      console.warn('[ThemeProvider] Multiple instances detected. Only one ThemeProvider should be mounted.');
    }
    document.documentElement.setAttribute(PROVIDER_ATTR, '');
    mounted.current = true;
    return () => {
      document.documentElement.removeAttribute(PROVIDER_ATTR);
    };
  }, []);

  const resolvedTheme = useMemo(() => resolveTheme(theme), [theme]);

  useEffect(() => {
    applyThemeToRoot(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== 'system' || !hasMatchMedia()) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      applyThemeToRoot(getSystemPreference());
      setThemeState('system');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    safeSetStorage(STORAGE_KEY, newTheme);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export { ThemeContext };
