'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { toast } from 'sonner';

interface SidebarProviderProps {
  agentCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const REVEAL_KEY = 'flow-sidebar-revealed';

export function SidebarProvider({
  agentCount,
  collapsed,
  onToggleCollapse,
}: SidebarProviderProps) {
  const prevCountRef = useRef(agentCount);

  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = agentCount;

    if (prev < 2 && agentCount >= 2) {
      const revealed = sessionStorage.getItem(REVEAL_KEY);
      if (!revealed) {
        toast.info('Your sidebar is ready — you have multiple agents active now.', {
          duration: 5000,
        });
        sessionStorage.setItem(REVEAL_KEY, 'true');
      }
    }
  }, [agentCount]);

  if (agentCount < 2) {
    return null;
  }

  return <Sidebar collapsed={collapsed} onToggleCollapse={onToggleCollapse} />;
}
