'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { sidebarCollapsedAtom, sidebarHoverExpandedAtom, commandPaletteOpenAtom } from '@flow/shared';
import { cn } from '../lib/utils';
import type { SearchResult } from '@flow/types';
import { SidebarErrorBoundary } from './sidebar-error-boundary';
import { SidebarProvider } from './sidebar-provider';
import { MobileTabBar } from './mobile-tab-bar';
import { CommandPalette } from '../components/command-palette/command-palette';
import { KeyboardListener } from '../components/command-palette/keyboard-listener';
import { ShortcutOverlay } from '../components/command-palette/shortcut-overlay';
import { useReducedMotion } from '../hooks/use-reduced-motion';

export interface WorkspaceShellProps {
  agentCount: number;
  children: React.ReactNode;
  workspaces?: Array<{ id: string; name: string; role: string }> | undefined;
  activeWorkspaceId?: string | undefined;
  onSwitchWorkspace?: ((workspaceId: string) => Promise<void>) | undefined;
  searchAction?: (query: string) => Promise<{ success: boolean; data?: SearchResult[]; error?: { message: string } }>;
  onNavigate?: (href: string) => void;
}

export function WorkspaceShell({
  agentCount,
  children,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  searchAction,
  onNavigate,
}: WorkspaceShellProps) {
  const [collapsed, setCollapsed] = useAtom(sidebarCollapsedAtom);
  const setHoverExpanded = useSetAtom(sidebarHoverExpandedAtom);
  const setPaletteOpen = useSetAtom(commandPaletteOpenAtom);
  const [hoverActive, setHoverActive] = useState(false);
  const reducedMotion = useReducedMotion();
  const [ariaMessage, setAriaMessage] = useState('');

  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const firstNavItemRef = useRef<HTMLAnchorElement | null>(null);
  const hoverExpandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announceAndSet = useCallback((v: boolean) => {
    setCollapsed(v);
    setAriaMessage(v ? 'Sidebar collapsed' : 'Sidebar expanded');
  }, [setCollapsed]);

  const handleToggleSidebar = useCallback((v: boolean) => {
    announceAndSet(v);
  }, [announceAndSet]);

  const handleToggle = useCallback(() => {
    announceAndSet(!collapsed);
  }, [collapsed, announceAndSet]);

  const showSidebar = agentCount >= 2;

  const handleMouseEnter = useCallback(() => {
    if (!showSidebar || !collapsed) return;
    if (hoverCollapseTimer.current) {
      clearTimeout(hoverCollapseTimer.current);
      hoverCollapseTimer.current = null;
    }
    hoverExpandTimer.current = setTimeout(() => {
      setHoverActive(true);
      setHoverExpanded(true);
    }, HOVER_EXPAND_DELAY);
  }, [showSidebar, collapsed, setHoverExpanded]);

  const handleMouseLeave = useCallback(() => {
    if (hoverExpandTimer.current) {
      clearTimeout(hoverExpandTimer.current);
      hoverExpandTimer.current = null;
    }
    hoverCollapseTimer.current = setTimeout(() => {
      setHoverActive(false);
      setHoverExpanded(false);
    }, HOVER_COLLAPSE_DELAY);
  }, [setHoverExpanded]);

  useEffect(() => {
    return () => {
      if (hoverExpandTimer.current) clearTimeout(hoverExpandTimer.current);
      if (hoverCollapseTimer.current) clearTimeout(hoverCollapseTimer.current);
    };
  }, []);

  const handleNavigate = useCallback((href: string) => {
    if (onNavigate) {
      onNavigate(href);
    } else if (typeof window !== 'undefined') {
      window.location.href = href;
    }
  }, [onNavigate]);

  const defaultSearchAction = useCallback(async (query: string) => {
    return { success: false, error: { message: 'Search not configured' } } as const;
  }, []);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-0 focus:top-0 focus:z-[var(--flow-z-overlay)] focus:bg-[var(--flow-color-bg-surface-raised)] focus:px-4 focus:py-2 focus:text-sm focus:text-[var(--flow-color-text-primary)] focus:shadow-lg focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)]"
      >
        Skip to main content
      </a>

      <div className="flex h-screen bg-[var(--flow-color-bg-primary)]">
        {showSidebar && (
          <div
            className="hidden shrink-0 flex-col lg:flex"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <SidebarErrorBoundary>
              <div
                className={cn(
                  'relative h-full',
                  collapsed && hoverActive && 'w-[var(--flow-sidebar-expanded)] shadow-lg',
                )}
                style={
                  collapsed && hoverActive
                    ? { position: 'absolute', zIndex: 'var(--flow-z-sticky)' }
                    : undefined
                }
              >
                <SidebarProvider
                  agentCount={agentCount}
                  collapsed={collapsed && !hoverActive}
                  onToggleCollapse={handleToggle}
                  toggleRef={toggleRef}
                  firstNavItemRef={firstNavItemRef}
                  workspaces={workspaces}
                  activeWorkspaceId={activeWorkspaceId}
                  onSwitchWorkspace={onSwitchWorkspace}
                />
              </div>
            </SidebarErrorBoundary>
          </div>
        )}

        <main
          id="main-content"
          className="min-w-0 flex-1 overflow-y-auto"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      <MobileTabBar />

      <KeyboardListener onToggleSidebar={handleToggleSidebar} />
      <CommandPalette
        searchAction={searchAction ?? defaultSearchAction}
        onNavigate={handleNavigate}
      />
      <ShortcutOverlay />

      <button
        type="button"
        aria-label="Open command palette"
        onClick={() => setPaletteOpen(true)}
        className="fixed right-4 top-3 z-[var(--flow-z-sticky)] flex h-8 w-8 items-center justify-center rounded-md border border-[var(--flow-color-border-primary)] bg-[var(--flow-color-bg-surface-raised)] text-[var(--flow-color-text-tertiary)] hover:bg-[var(--flow-color-bg-surface-hover)] hover:text-[var(--flow-color-text-primary)] focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)] md:hidden"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6.5 11a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM11 6.5a4.48 4.48 0 0 1-.94 2.77l3.34 3.33-.71.71-3.33-3.34A4.48 4.48 0 0 1 6.5 11 5.5 5.5 0 1 1 11 6.5Z" fill="currentColor" />
        </svg>
      </button>

      <div aria-live="polite" className="sr-only">
        {ariaMessage}
      </div>
    </>
  );
}

const HOVER_EXPAND_DELAY = 300;
const HOVER_COLLAPSE_DELAY = 200;
