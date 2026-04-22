'use client';

import { useEffect, useRef } from 'react';
import { Sidebar } from './sidebar';
import { toast } from 'sonner';

interface SidebarProviderProps {
  agentCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  toggleRef?: React.RefObject<HTMLButtonElement | null>;
  firstNavItemRef?: React.RefObject<HTMLAnchorElement | null>;
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
    />
  );
}
