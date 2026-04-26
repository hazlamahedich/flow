'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Inbox,
  Calendar,
  Bot,
  Users,
  FileText,
  Clock,
  BarChart3,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { WorkspaceSwitcher } from './workspace-switcher';
import type { AgentStatusBarEntry } from '../components/agent-status-bar/agent-status-bar';
import { AgentStatusBar } from '../components/agent-status-bar/agent-status-bar';

const NAV_ITEMS = [
  { href: '/inbox', label: 'Inbox', Icon: Inbox },
  { href: '/calendar', label: 'Calendar', Icon: Calendar },
  { href: '/agents', label: 'Agents', Icon: Bot },
  { href: '/clients', label: 'Clients', Icon: Users },
  { href: '/invoices', label: 'Invoices', Icon: FileText },
  { href: '/time', label: 'Time', Icon: Clock },
  { href: '/reports', label: 'Reports', Icon: BarChart3 },
  { href: '/settings', label: 'Settings', Icon: Settings },
] as const;

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  toggleRef?: React.RefObject<HTMLButtonElement | null> | undefined;
  firstNavItemRef?: React.RefObject<HTMLAnchorElement | null> | undefined;
  workspaces?: Array<{ id: string; name: string; role: string }> | undefined;
  activeWorkspaceId?: string | undefined;
  onSwitchWorkspace?: ((workspaceId: string) => Promise<void>) | undefined;
  agentStatusEntries?: AgentStatusBarEntry[] | undefined;
}

export function Sidebar({ collapsed, onToggleCollapse, toggleRef, firstNavItemRef, workspaces, activeWorkspaceId, onSwitchWorkspace, agentStatusEntries }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)] transition-[width] motion-reduce:transition-none',
        collapsed
          ? 'w-[var(--flow-sidebar-collapsed)]'
          : 'w-[var(--flow-sidebar-expanded)]',
      )}
      data-testid="sidebar"
    >
      <div className="flex shrink-0 items-center justify-between p-2">
        {!collapsed && workspaces && workspaces.length > 0 && activeWorkspaceId && onSwitchWorkspace && (
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSwitch={onSwitchWorkspace}
          />
        )}
        <button
          ref={toggleRef}
          type="button"
          onClick={onToggleCollapse}
          className="rounded-[var(--flow-radius-sm)] p-1.5 text-[var(--flow-color-text-tertiary)] hover:bg-[var(--flow-state-overlay-hover)] hover:text-[var(--flow-color-text-primary)] focus-visible:outline focus-visible:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)] focus-visible:outline-offset-1"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          data-testid="sidebar-collapse-toggle"
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav aria-label="Main navigation" className="flex-1 min-h-0 overflow-y-auto px-2">
        <ul className="space-y-1" role="list">
          {NAV_ITEMS.map(({ href, label, Icon }, index) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <li key={href}>
                <Link
                  href={href}
                  ref={index === 0 ? firstNavItemRef : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-[var(--flow-radius-sm)] px-3 py-2 text-sm transition-colors motion-reduce:transition-none',
                    'hover:bg-[var(--flow-state-overlay-hover)] hover:text-[var(--flow-color-text-primary)]',
                    'focus-visible:outline focus-visible:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)] focus-visible:outline-offset-1',
                    isActive
                      ? 'border-l-2 border-[var(--flow-color-accent-gold)] text-[var(--flow-color-text-primary)] bg-[var(--flow-state-overlay-active)]'
                      : 'text-[var(--flow-color-text-secondary)]',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span
                    className={cn(
                      'truncate',
                      collapsed && 'sr-only',
                    )}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {agentStatusEntries && agentStatusEntries.length >= 1 && (
        <div className="shrink-0 border-t border-[var(--flow-color-border-default)] px-2 py-1">
          <AgentStatusBar agents={agentStatusEntries} collapsed={collapsed} />
        </div>
      )}

      <div
        className="shrink-0 border-t border-[var(--flow-color-border-default)] p-3 flex items-center gap-2"
        aria-label="Timer area — coming soon"
        data-testid="sidebar-timer-slot"
      >
        <Clock
          className="h-5 w-5 opacity-50 text-[var(--flow-color-text-muted)]"
          aria-hidden="true"
        />
        <span
          className={cn(
            'text-xs text-[var(--flow-color-text-muted)]',
            collapsed && 'sr-only',
          )}
        >
          Timer
        </span>
      </div>
    </div>
  );
}

export { NAV_ITEMS };
