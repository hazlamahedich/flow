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
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

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
  collapsed: boolean,
  setCollapsed: (v: boolean) => void,
) {
  const toggleRef = useRef<HTMLButtonElement | null>(null);

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
      } else {
        setCollapsed(true);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [collapsed, setCollapsed]);

  return toggleRef;
}

export function WorkspaceShell({ agentCount, children }: WorkspaceShellProps) {
  const [collapsed, setCollapsed] = useAtom(sidebarCollapsedAtom);
  const setHoverExpanded = useSetAtom(sidebarHoverExpandedAtom);
  const [hoverActive, setHoverActive] = useState(false);
  const reducedMotion = useReducedMotion();
  const [ariaMessage, setAriaMessage] = useState('');

  const toggleRef = useSidebarKeyboard(collapsed, (v) => {
    setCollapsed(v);
    setAriaMessage(v ? 'Sidebar collapsed' : 'Sidebar expanded');
  });

  const handleToggle = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    setAriaMessage(next ? 'Sidebar collapsed' : 'Sidebar expanded');
  }, [collapsed, setCollapsed]);

  const showSidebar = agentCount >= 2;

  const handleMouseEnter = useCallback(() => {
    if (!showSidebar || !collapsed) return;
    setHoverActive(true);
    setHoverExpanded(true);
  }, [showSidebar, collapsed, setHoverExpanded]);

  const handleMouseLeave = useCallback(() => {
    setHoverActive(false);
    setHoverExpanded(false);
  }, [setHoverExpanded]);

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
                  collapsed && hoverActive && 'w-[var(--flow-layout-sidebar-expanded)] shadow-lg',
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
