'use client';

import { useEffect, useRef } from 'react';
import { Sidebar } from './sidebar';
import { toast } from 'sonner';
import type { AgentStatusBarEntry } from '../components/agent-status-bar/agent-status-bar';

interface SidebarProviderProps {
  agentCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  toggleRef?: React.RefObject<HTMLButtonElement | null>;
  firstNavItemRef?: React.RefObject<HTMLAnchorElement | null>;
  workspaces?: Array<{ id: string; name: string; role: string }> | undefined;
  activeWorkspaceId?: string | undefined;
  onSwitchWorkspace?: ((workspaceId: string) => Promise<void>) | undefined;
  agentStatusEntries?: AgentStatusBarEntry[] | undefined;
  scopeAlertCount?: number | undefined;
}

const REVEAL_KEY = 'flow-sidebar-revealed';

function safeGetSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetSessionItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Storage access blocked (Safari ITP, Incognito)
  }
}

export function SidebarProvider({
  agentCount,
  collapsed,
  onToggleCollapse,
  toggleRef,
  firstNavItemRef,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  agentStatusEntries,
  scopeAlertCount,
}: SidebarProviderProps) {
  const prevCountRef = useRef(agentCount);

  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = agentCount;

    if (prev < 2 && agentCount >= 2) {
      const revealed = safeGetSessionItem(REVEAL_KEY);
      if (!revealed) {
        toast.info('Your sidebar is ready — you have multiple agents active now.', {
          duration: 5000,
        });
        safeSetSessionItem(REVEAL_KEY, 'true');
      }
    }
  }, [agentCount]);

  if (agentCount < 2) {
    return null;
  }

  return (
    <Sidebar
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      toggleRef={toggleRef}
      firstNavItemRef={firstNavItemRef}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
      onSwitchWorkspace={onSwitchWorkspace}
      agentStatusEntries={agentStatusEntries}
      scopeAlertCount={scopeAlertCount}
    />
  );
}
