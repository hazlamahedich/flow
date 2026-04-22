'use client';

import { useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';
import {
  undoStacksAtom,
  createUndoStackActions,
} from '@flow/shared';
import type { UndoActionSeverity, UndoActionType } from '@flow/shared';
import { useUndoWorkspaceId } from './undo-workspace-context';

interface UseUndoMutationOptions {
  entityType: string;
  entityId: string;
  actionType: UndoActionType;
  severity?: UndoActionSeverity;
  irreversible?: boolean;
  description: string;
  previousSnapshot: Record<string, unknown>;
  version: number;
  operationId: string;
}

export function useUndoMutation() {
  const workspaceId = useUndoWorkspaceId();
  const [stacks, setStacks] = useAtom(undoStacksAtom);
  const actions = useMemo(() => createUndoStackActions(workspaceId), [workspaceId]);

  const recordUndo = useCallback(
    (options: UseUndoMutationOptions) => {
      const entry = {
        id: crypto.randomUUID(),
        operationId: options.operationId,
        actionType: options.actionType,
        severity: options.severity ?? 'whisper',
        irreversible: options.irreversible ?? false,
        entityType: options.entityType,
        entityId: options.entityId,
        description: options.description,
        snapshot: options.previousSnapshot,
        expectedVersion: options.version,
        workspaceId,
        createdAt: Date.now(),
      };
      setStacks((prev) => actions.addEntry(prev, entry));
    },
    [actions, setStacks, workspaceId],
  );

  return { recordUndo };
}
