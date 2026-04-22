'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkspaceShellProps } from '@flow/ui';
import { WorkspaceShell } from '@flow/ui';
import { searchEntitiesAction } from './actions/search-entities';

export function WorkspaceShellClient({
  agentCount,
  children,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
}: Omit<WorkspaceShellProps, 'searchAction' | 'onNavigate'> & {
  onSwitchWorkspace?: (workspaceId: string) => Promise<void>;
}) {
  const router = useRouter();

  const searchAction = useCallback(async (query: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);
    try {
      return await searchEntitiesAction({ query });
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  const handleNavigate = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  return (
    <WorkspaceShell
      agentCount={agentCount}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
      onSwitchWorkspace={onSwitchWorkspace}
      searchAction={searchAction}
      onNavigate={handleNavigate}
    >
      {children}
    </WorkspaceShell>
  );
}
