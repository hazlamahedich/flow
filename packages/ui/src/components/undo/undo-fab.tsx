'use client';

import { useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';
import { undoStacksAtom, createUndoStackActions } from '@flow/shared';
import { useUndoWorkspaceId } from './undo-workspace-context';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

export function UndoFab() {
  const workspaceId = useUndoWorkspaceId();
  const [stacks, setStacks] = useAtom(undoStacksAtom);
  const actions = useMemo(() => createUndoStackActions(workspaceId), [workspaceId]);
  const stack = actions.getStack(stacks);
  const reducedMotion = useReducedMotion();

  const handleUndo = useCallback(() => {
    setStacks((prev) => {
      const { stacks: next, entry } = actions.popEntry(prev);
      if (!entry) return prev;
      return next;
    });
  }, [actions, setStacks]);

  if (stack.entries.length === 0) return null;

  return (
    <button
      onClick={handleUndo}
      className="fixed bottom-20 right-4 z-[var(--flow-z-sticky)] flex h-12 w-12 items-center justify-center rounded-full border border-[var(--flow-color-border-primary)] bg-[var(--flow-color-bg-surface-raised)] shadow-lg hover:bg-[var(--flow-color-bg-surface-hover)] focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)] md:hidden"
      aria-label="Undo last action"
      style={
        reducedMotion
          ? undefined
          : { animation: 'fadeIn 150ms ease-out' }
      }
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 8h8a4 4 0 0 1 0 8H9m-5-8l3-3m-3 3 3 3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
