import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithTheme } from '@flow/test-utils';
import { WorkspaceSwitcher } from './workspace-switcher';

const mockOnSwitch = vi.fn();

const workspaces = [
  { id: 'ws-1', name: 'Acme Corp', role: 'owner' },
  { id: 'ws-2', name: 'Beta LLC', role: 'member' },
];

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
  vi.clearAllMocks();
});

describe('WorkspaceSwitcher', () => {
  it('renders workspace name', () => {
    const { container } = renderWithTheme(
      <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId="ws-1" onSwitch={mockOnSwitch} />,
    );
    expect(container.textContent).toContain('Acme Corp');
  });

  it('renders trigger for multi-workspace', () => {
    const { container } = renderWithTheme(
      <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId="ws-1" onSwitch={mockOnSwitch} />,
    );
    const trigger = container.querySelector('[data-testid="workspace-switcher-trigger"]');
    expect(trigger).toBeTruthy();
  });

  it('renders name only for single workspace', () => {
    const single = [{ id: 'ws-1', name: 'Solo', role: 'owner' }];
    const { container } = renderWithTheme(
      <WorkspaceSwitcher workspaces={single} activeWorkspaceId="ws-1" onSwitch={mockOnSwitch} />,
    );
    const trigger = container.querySelector('[data-testid="workspace-switcher-trigger"]');
    expect(trigger).toBeNull();
    expect(container.textContent).toContain('Solo');
  });

  it('shows chevron icon for multi-workspace', () => {
    const { container } = renderWithTheme(
      <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId="ws-1" onSwitch={mockOnSwitch} />,
    );
    const trigger = container.querySelector('[data-testid="workspace-switcher-trigger"]');
    expect(trigger?.querySelector('svg')).toBeTruthy();
  });
});
