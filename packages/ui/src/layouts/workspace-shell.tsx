'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { sidebarCollapsedAtom, sidebarHoverExpandedAtom } from '@flow/shared';
import { cn } from '../lib/utils';
import { SidebarErrorBoundary } from './sidebar-error-boundary';
import { SidebarProvider } from './sidebar-provider';
import { MobileTabBar } from './mobile-tab-bar';

export interface WorkspaceShellProps {
  agentCount: number;
  children: React.ReactNode;
  workspaces?: Array<{ id: string; name: string; role: string }> | undefined;
  activeWorkspaceId?: string | undefined;
  onSwitchWorkspace?: ((workspaceId: string) => Promise<void>) | undefined;
}

function getReducedMotionInitial(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(getReducedMotionInitial);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

function useSidebarKeyboard(
  setCollapsed: (v: boolean) => void,
  firstNavItemRef: React.RefObject<HTMLAnchorElement | null>,
  toggleRef: React.RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== ']' && e.key !== '[') return;

      const el = e.target as HTMLElement;
      if (el && typeof el.getAttribute === 'function') {
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      e.preventDefault();

      if (e.key === ']') {
        setCollapsed(false);
        firstNavItemRef.current?.focus();
      } else {
        setCollapsed(true);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setCollapsed, firstNavItemRef, toggleRef]);
}

const HOVER_EXPAND_DELAY = 300;
const HOVER_COLLAPSE_DELAY = 200;

export function WorkspaceShell({ agentCount, children, workspaces, activeWorkspaceId, onSwitchWorkspace }: WorkspaceShellProps) {
  const [collapsed, setCollapsed] = useAtom(sidebarCollapsedAtom);
  const setHoverExpanded = useSetAtom(sidebarHoverExpandedAtom);
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

  useSidebarKeyboard(announceAndSet, firstNavItemRef, toggleRef);

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
        >
          {children}
        </main>
      </div>

      <MobileTabBar />

      <div aria-live="polite" className="sr-only">
        {ariaMessage}
      </div>
    </>
  );
}
