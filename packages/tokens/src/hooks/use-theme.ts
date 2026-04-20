'use client';

import { useContext } from 'react';
import { ThemeContext } from '../providers/theme-provider';
import type { Theme, ResolvedTheme } from '../providers/theme-provider';

interface UseThemeReturn {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

export function useTheme(): UseThemeReturn {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
