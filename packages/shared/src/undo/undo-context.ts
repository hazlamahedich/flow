export const UNDO_WORKSPACE_CONTEXT_KEY = '__flow_undo_workspace_id__';

export function createUndoWorkspaceContextValue(workspaceId: string): string {
  return workspaceId;
}

export function readUndoWorkspaceContextValue(value: string | null): string | null {
  return value;
}
