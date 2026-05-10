'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkspaceShellProps } from '@flow/ui';
import { WorkspaceShell, UndoWorkspaceProvider, UndoProvider, UndoFab } from '@flow/ui';
import { searchEntitiesAction } from './actions/search-entities';
import { undoAction } from '@/lib/actions/undo';
import { OverlayHost } from './components/overlay-host';
import { TrustAnnouncerRegion } from '@/lib/hooks/use-trust-announcer';
import { startTimerAction, stopTimerAction, getTimerStateAction } from './time/actions/timer-actions';
import { listClientsForTimerAction } from './time/actions/list-clients-for-timer';
import { listProjectsAction } from './time/actions/list-projects';
import type { TimerStateWithNames } from '@flow/ui';

export function WorkspaceShellClient({
  agentCount,
  children,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  initialTimerState,
}: Omit<WorkspaceShellProps, 'searchAction' | 'onNavigate' | 'timerProps'> & {
  onSwitchWorkspace?: (workspaceId: string) => Promise<void>;
  initialTimerState: TimerStateWithNames | null;
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

  const timerProps = useMemo(() => ({
    initialTimerState,
    onStart: startTimerAction,
    onStop: (timerId: string) => stopTimerAction({ timerId }),
    onGetTimerState: getTimerStateAction,
    onListClients: listClientsForTimerAction,
    onListProjects: (clientId: string) => listProjectsAction({ clientId }),
  }), [initialTimerState]);

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
          timerProps={timerProps}
        >
          {children}
        </WorkspaceShell>
        <UndoFab />
      </UndoProvider>
    </UndoWorkspaceProvider>
  );
}
