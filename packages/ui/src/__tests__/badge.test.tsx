import { describe, it, expect } from 'vitest';
import { renderWithTheme } from '@flow/test-utils';
import { screen } from '@testing-library/react';
import { Badge } from '../components/badge/badge';

describe('Badge', () => {
  it('renders with default variant', () => {
    renderWithTheme(<Badge>Badge</Badge>);
    expect(screen.getByText('Badge')).toBeTruthy();
  });

  it('renders all variants', () => {
    const variants = ['default', 'secondary', 'outline', 'success', 'warning', 'error'] as const;
    for (const variant of variants) {
      const { unmount } = renderWithTheme(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).toBeTruthy();
      unmount();
    }
  });

  it('renders agent identity variants', () => {
    const agents = ['inbox', 'calendar', 'ar', 'report', 'health', 'time'] as const;
    for (const agent of agents) {
      const { unmount } = renderWithTheme(<Badge agent={agent}>{agent}</Badge>);
      const el = screen.getByText(agent);
      expect(el.className).toContain(`flow-agent-${agent}`);
      unmount();
    }
  });

  it('consumes token CSS vars', () => {
    renderWithTheme(<Badge>Test</Badge>);
    const el = screen.getByText('Test');
    expect(el.className).toContain('rounded-[var(--flow-radius-full)]');
  });
});
