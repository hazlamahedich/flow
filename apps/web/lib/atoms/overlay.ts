import { atom } from 'jotai';
import { atomWithReducer } from 'jotai/utils';

export interface OverlayEntry {
  id: string;
  type: string;
  priority: number;
  props: Record<string, unknown>;
  createdAt: number;
}

export type OverlayAction =
  | { type: 'push'; entry: OverlayEntry }
  | { type: 'pop'; id: string }
  | { type: 'clear' }
  | { type: 'rehydrate'; entries: OverlayEntry[] };

function sortAndDeduplicate(stack: OverlayEntry[]): OverlayEntry[] {
  const seen = new Map<string, OverlayEntry>();
  for (const entry of stack) {
    const existing = seen.get(entry.id);
    if (!existing || entry.createdAt >= existing.createdAt) {
      seen.set(entry.id, entry);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.priority - a.priority);
}

export function overlayReducer(
  state: OverlayEntry[],
  action: OverlayAction,
): OverlayEntry[] {
  switch (action.type) {
    case 'push':
      return sortAndDeduplicate([...state, action.entry]);
    case 'pop':
      return state.filter((e) => e.id !== action.id);
    case 'clear':
      return [];
    case 'rehydrate':
      return sortAndDeduplicate([...state, ...action.entries]);
    default:
      return state;
  }
}

export const overlayStackAtom = atomWithReducer<OverlayEntry[], OverlayAction>(
  [],
  overlayReducer,
);

export const topOverlayAtom = atom<OverlayEntry | null>((get) => {
  const stack = get(overlayStackAtom);
  return stack.length > 0 ? stack[0]! : null;
});
