'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkspaceShellProps } from '@flow/ui';
import { WorkspaceShell, UndoWorkspaceProvider, UndoProvider, UndoFab } from '@flow/ui';
import { searchEntitiesAction } from './actions/search-entities';
import { undoAction } from '@/lib/actions/undo';
import { OverlayHost } from './components/overlay-host';
import { TrustAnnouncerRegion } from '@/lib/hooks/use-trust-announcer';

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

  if (!activeWorkspaceId) {
    return (
      <>
        <TrustAnnouncerRegion />
        <WorkspaceShell
          agentCount={agentCount}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitchWorkspace={onSwitchWorkspace}
          searchAction={searchAction}
          onNavigate={handleNavigate}
          overlaySlot={<OverlayHost />}
        >
          {children}
        </WorkspaceShell>
      </>
    );
  }

  return (
    <UndoWorkspaceProvider workspaceId={activeWorkspaceId}>
      <UndoProvider undoAction={undoAction}>
        <TrustAnnouncerRegion />
        <WorkspaceShell
          agentCount={agentCount}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitchWorkspace={onSwitchWorkspace}
          searchAction={searchAction}
          onNavigate={handleNavigate}
          overlaySlot={<OverlayHost />}
        >
          {children}
        </WorkspaceShell>
        <UndoFab />
      </UndoProvider>
    </UndoWorkspaceProvider>
  );
}
