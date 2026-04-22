'use client';

import type { ReactNode } from 'react';
import { UndoWorkspaceContext } from './undo-workspace-context';

interface UndoWorkspaceProviderProps {
  workspaceId: string;
  children: ReactNode;
}

export function UndoWorkspaceProvider({ workspaceId, children }: UndoWorkspaceProviderProps) {
  return (
    <UndoWorkspaceContext.Provider value={workspaceId}>
      {children}
    </UndoWorkspaceContext.Provider>
  );
}
