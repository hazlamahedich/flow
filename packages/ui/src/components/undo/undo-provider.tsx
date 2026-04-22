'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { undoStacksAtom, createUndoStackActions } from '@flow/shared';
import { useUndoWorkspaceId } from './undo-workspace-context';
import { StickyUndoToast } from './undo-toast';
import type { UndoEntry } from '@flow/shared';
import type { ActionResult } from '@flow/types';

export interface UndoActionFn {
  (input: {
    operationId: string;
    entityType: string;
    entityId: string;
    expectedVersion: number;
    previousSnapshot: Record<string, unknown>;
  }): Promise<ActionResult<Record<string, unknown>>>;
}

interface UndoProviderProps {
  children: React.ReactNode;
  undoAction: UndoActionFn;
}

export function UndoProvider({ children, undoAction }: UndoProviderProps) {
  const workspaceId = useUndoWorkspaceId();
  const [stacks, setStacks] = useAtom(undoStacksAtom);
  const actions = useMemo(() => createUndoStackActions(workspaceId), [workspaceId]);
  const stack = actions.getStack(stacks);
  const router = useRouter();

  const [latestEntry, setLatestEntry] = useState<UndoEntry | null>(null);

  useEffect(() => {
    if (stack.entries.length > 0) {
      setLatestEntry(stack.entries[0]);
    } else {
      setLatestEntry(null);
    }
  }, [stack.entries]);

  const pruneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pruneTimerRef.current = setInterval(() => {
      setStacks((prev) => actions.pruneExpired(prev));
    }, 5000);

    return () => {
      if (pruneTimerRef.current) {
        clearInterval(pruneTimerRef.current);
      }
    };
  }, [actions, setStacks]);

  const handleUndo = useCallback(async () => {
    let poppedEntry: UndoEntry | undefined;

    setStacks((prev) => {
      const { stacks: next, entry } = actions.popEntry(prev);
      poppedEntry = entry;
      return next;
    });

    if (!poppedEntry) return;

    try {
      const result = await undoAction({
        operationId: poppedEntry.operationId,
        entityType: poppedEntry.entityType,
        entityId: poppedEntry.entityId,
        expectedVersion: poppedEntry.expectedVersion,
        previousSnapshot: poppedEntry.snapshot,
      });

      if (!result.success) {
        try {
          router.refresh();
        } catch (refreshError) {
          console.warn('Undo rollback refresh failed:', refreshError);
        }
      }
    } catch (error) {
      console.warn('Undo action failed, refreshing:', error);
      try {
        router.refresh();
      } catch (refreshError) {
        console.warn('Undo fallback refresh failed:', refreshError);
      }
    }
  }, [actions, undoAction, router]);

  const handleDismiss = useCallback(() => {
    setLatestEntry(null);
  }, []);

  return (
    <>
      {children}
      {latestEntry && (
        <StickyUndoToast
          actionLabel={latestEntry.description}
          onUndo={handleUndo}
          onDismiss={handleDismiss}
          severity={latestEntry.severity}
          irreversible={latestEntry.irreversible}
          stackedCount={stack.entries.length > 1 ? stack.entries.length : undefined}
        />
      )}
    </>
  );
}
