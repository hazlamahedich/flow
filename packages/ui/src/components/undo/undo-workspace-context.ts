'use client';

import { createContext, useContext } from 'react';

export const UndoWorkspaceContext = createContext<string | null>(null);

export function useUndoWorkspaceId(): string {
  const workspaceId = useContext(UndoWorkspaceContext);
  if (!workspaceId) {
    throw new Error(
      'useUndoWorkspaceId must be used within an UndoWorkspaceContext.Provider. ' +
      'Wrap your workspace shell with UndoWorkspaceProvider.',
    );
  }
  return workspaceId;
}
