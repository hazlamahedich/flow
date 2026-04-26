import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithTheme } from '@flow/test-utils';
import { AgentStatusBar } from './agent-status-bar';
import type { AgentStatusBarEntry } from './agent-status-bar';

beforeEach(() => {
  document.documentElement.removeAttribute('data-flow-theme-provider');
  document.documentElement.removeAttribute('data-theme');
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

const makeEntry = (overrides: Partial<AgentStatusBarEntry> = {}): AgentStatusBarEntry => ({
  agentId: 'inbox',
  badgeProps: null,
  statusRing: 'active',
  pendingCount: 0,
  ...overrides,
});

const supervisedBadge = {
  state: 'supervised' as const,
  label: 'Learning',
  colorToken: '--flow-emotion-trust-building',
  borderStyle: '1px solid',
  animState: 'default' as const,
};

describe('AgentStatusBar', () => {
  describe('cadence tiers', () => {
    it('renders high-cadence agents (Inbox, Calendar) expanded', () => {
      const agents: AgentStatusBarEntry[] = [
        makeEntry({ agentId: 'inbox', statusRing: 'active' }),
        makeEntry({ agentId: 'calendar', statusRing: 'active' }),
      ];
      const { container } = renderWithTheme(<AgentStatusBar agents={agents} />);
      const items = container.querySelectorAll('[role="listitem"]');
      expect(items.length).toBe(2);
      expect(container.textContent).toContain('Inbox');
      expect(container.textContent).toContain('Calendar');
    });

    it('renders low-cadence agents (AR, Report, Health) compact', () => {
      const agents: AgentStatusBarEntry[] = [
        makeEntry({ agentId: 'ar-collection' }),
        makeEntry({ agentId: 'weekly-report' }),
        makeEntry({ agentId: 'client-health' }),
      ];
      const { container } = renderWithTheme(<AgentStatusBar agents={agents} />);
      expect(container.querySelectorAll('[role="listitem"]').length).toBe(3);
    });

    it('renders ambient agent (Time) as dot only', () => {
      const agents: AgentStatusBarEntry[] = [
        makeEntry({ agentId: 'time-integrity' }),
      ];
      const { container } = renderWithTheme(<AgentStatusBar agents={agents} />);
      expect(container.querySelectorAll('[role="listitem"]').length).toBe(1);
    });

    it('sorts agents by cadence tier (high first)', () => {
      const agents: AgentStatusBarEntry[] = [
        makeEntry({ agentId: 'time-integrity' }),
        makeEntry({ agentId: 'inbox' }),
        makeEntry({ agentId: 'ar-collection' }),
      ];
      const { container } = renderWithTheme(<AgentStatusBar agents={agents} />);
      const items = container.querySelectorAll('[role="listitem"]');
      expect(items[0]?.getAttribute('aria-label')).toContain('Inbox');
    });
  });

  describe('status rings', () => {
    it('renders active status ring (green)', () => {
      const agents = [makeEntry({ agentId: 'inbox', statusRing: 'active' })];
      const { container } = renderWithTheme(<AgentStatusBar agents={agents} />);
      const dot = container.querySelector('span[style*="box-shadow"]');
      expect(dot).toBeTruthy();
    });

    it('renders error status ring (red)', () => {
      const agents = [makeEntry({ agentId: 'inbox', statusRing: 'error' })];
      const { container } = renderWithTheme(<AgentStatusBar agents={agents} />);
      const dot = container.querySelector('span[style*="box-shadow"]');
      expect(dot).toBeTruthy();
    });

    it('renders offline status ring (gray)', () => {
      const agents = [makeEntry({ agentId: 'inbox', statusRing: 'offline' })];
      const { container } = renderWithTheme(<AgentStatusBar agents={agents} />);
      const items = container.querySelectorAll('[role="listitem"]');
      expect(items.length).toBe(1);
    });
  });

  describe('trust badge integration', () => {
    it('renders inline trust badge for high-cadence agent', () => {
      const agents = [makeEntry({ agentId: 'inbox', badgeProps: supervisedBadge })];
      const { container } = renderWithTheme(<AgentStatusBar agents={agents} />);
      expect(container.textContent).toContain('Learning');
    });

    it('renders sidebar trust badge for low-cadence agent', () => {
      const agents = [makeEntry({ agentId: 'ar-collection', badgeProps: supervisedBadge })];
      const { container } = renderWithTheme(<AgentStatusBar agents={agents} />);
      const statusElements = container.querySelectorAll('[role="status"]');
      expect(statusElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('pending count', () => {
    it('renders pending count badge', () => {
      const agents = [makeEntry({ agentId: 'inbox', pendingCount: 5 })];
      const { container } = renderWithTheme(<AgentStatusBar agents={agents} />);
      expect(container.textContent).toContain('5');
    });

    it('hides pending count when zero', () => {
      const agents = [makeEntry({ agentId: 'inbox', pendingCount: 0 })];
      const { container } = renderWithTheme(<AgentStatusBar agents={agents} />);
      expect(container.textContent).not.toContain('0');
    });
  });

  describe('collapsed sidebar', () => {
    it('renders all agents compact when collapsed', () => {
      const agents: AgentStatusBarEntry[] = [
        makeEntry({ agentId: 'inbox' }),
        makeEntry({ agentId: 'ar-collection' }),
      ];
      const { container } = renderWithTheme(<AgentStatusBar agents={agents} collapsed />);
      const items = container.querySelectorAll('[role="listitem"]');
      expect(items.length).toBe(2);
    });
  });

  describe('accessibility', () => {
    it('has region role with label', () => {
      const agents = [makeEntry()];
      const { container } = renderWithTheme(<AgentStatusBar agents={agents} />);
      const region = container.querySelector('[data-testid="agent-status-bar"]');
      expect(region).toBeTruthy();
      expect(region?.getAttribute('aria-label')).toBe('Agent status');
    });
  });
});
