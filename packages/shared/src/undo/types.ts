export type UndoActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'archive';

export type UndoActionSeverity = 'whisper' | 'ceremony';

export interface UndoEntry {
  id: string;
  operationId: string;
  actionType: UndoActionType;
  severity: UndoActionSeverity;
  irreversible: boolean;
  entityType: string;
  entityId: string;
  description: string;
  snapshot: Record<string, unknown>;
  expectedVersion: number;
  workspaceId: string;
  createdAt: number;
}

export interface UndoStack {
  entries: UndoEntry[];
  maxEntries: number;
  maxAgeMs: number;
}

export const UNDO_MAX_ENTRIES = 10;
export const UNDO_WINDOW_MS = 30_000;
export const UNDO_MAX_SNAPSHOT_BYTES = 4_096;
