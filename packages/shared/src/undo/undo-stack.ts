import { atom } from 'jotai';
import {
  UNDO_MAX_ENTRIES,
  UNDO_MAX_SNAPSHOT_BYTES,
  UNDO_WINDOW_MS,
} from './types';
import type { UndoEntry, UndoStack } from './types';

export type { UndoEntry, UndoStack, UndoActionType, UndoActionSeverity } from './types';
export { UNDO_MAX_ENTRIES, UNDO_WINDOW_MS, UNDO_MAX_SNAPSHOT_BYTES } from './types';

function createEmptyStack(): UndoStack {
  return {
    entries: [],
    maxEntries: UNDO_MAX_ENTRIES,
    maxAgeMs: UNDO_WINDOW_MS,
  };
}

const undoStacksAtom = atom(new Map<string, UndoStack>());

function getWorkspaceKey(workspaceId: string): string {
  return `undo:${workspaceId}`;
}

function pruneExpired(entries: UndoEntry[], now: number): UndoEntry[] {
  return entries.filter((entry) => now - entry.createdAt < UNDO_WINDOW_MS);
}

function measureSnapshot(snapshot: Record<string, unknown>): number {
  try {
    return new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
  } catch {
    return Infinity;
  }
}

export function createUndoStackActions(workspaceId: string) {
  const key = getWorkspaceKey(workspaceId);

  return {
    getStack(stacks: Map<string, UndoStack>): UndoStack {
      return stacks.get(key) ?? createEmptyStack();
    },

    addEntry(stacks: Map<string, UndoStack>, entry: UndoEntry): Map<string, UndoStack> {
      const next = new Map(stacks);
      const stack = next.get(key) ?? createEmptyStack();
      const now = Date.now();

      let entries = pruneExpired([...stack.entries], now);

      if (measureSnapshot(entry.snapshot) > UNDO_MAX_SNAPSHOT_BYTES) {
        const oversizedEntry: UndoEntry = {
          ...entry,
          snapshot: {},
          irreversible: true,
          description: `${entry.description} (snapshot too large)`,
        };
        entries = [oversizedEntry, ...entries].slice(0, UNDO_MAX_ENTRIES);
      } else {
        entries = [entry, ...entries].slice(0, UNDO_MAX_ENTRIES);
      }

      next.set(key, { ...stack, entries });
      return next;
    },

    popEntry(stacks: Map<string, UndoStack>): {
      stacks: Map<string, UndoStack>;
      entry: UndoEntry | undefined;
    } {
      const next = new Map(stacks);
      const stack = next.get(key) ?? createEmptyStack();
      const now = Date.now();
      const entries = pruneExpired(stack.entries, now);

      if (entries.length === 0) {
        next.set(key, { ...stack, entries: [] });
        return { stacks: next, entry: undefined };
      }

      const [popped, ...remaining] = entries;
      next.set(key, { ...stack, entries: remaining });
      return { stacks: next, entry: popped };
    },

    clearStack(stacks: Map<string, UndoStack>): Map<string, UndoStack> {
      const next = new Map(stacks);
      const stack = next.get(key) ?? createEmptyStack();
      next.set(key, { ...stack, entries: [] });
      return next;
    },

    pruneExpired(stacks: Map<string, UndoStack>): Map<string, UndoStack> {
      const next = new Map(stacks);
      const stack = next.get(key) ?? createEmptyStack();
      const now = Date.now();
      const entries = pruneExpired(stack.entries, now);
      next.set(key, { ...stack, entries });
      return next;
    },
  };
}

export {
  undoStacksAtom,
  createEmptyStack,
  pruneExpired,
  measureSnapshot,
  getWorkspaceKey,
};
