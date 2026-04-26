import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from 'jotai';
import {
  overlayStackAtom,
  topOverlayAtom,
  overlayReducer,
  type OverlayEntry,
  type OverlayAction,
} from '../../../../lib/atoms/overlay';

function makeEntry(overrides: Partial<OverlayEntry> = {}): OverlayEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2, 8)}`,
    type: 'trust-ceremony',
    priority: 50,
    props: {},
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('overlayReducer', () => {
  it('pushes an entry onto empty stack', () => {
    const entry = makeEntry({ priority: 50 });
    const result = overlayReducer([], { type: 'push', entry });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(entry.id);
  });

  it('sorts by priority descending (highest first)', () => {
    const low = makeEntry({ id: 'low', priority: 30 });
    const high = makeEntry({ id: 'high', priority: 60 });
    const result = overlayReducer([low], { type: 'push', entry: high });
    expect(result[0]!.id).toBe('high');
    expect(result[1]!.id).toBe('low');
  });

  it('pops an entry by id', () => {
    const a = makeEntry({ id: 'a', priority: 50 });
    const b = makeEntry({ id: 'b', priority: 30 });
    const pushed = overlayReducer([], { type: 'push', entry: a });
    const withB = overlayReducer(pushed, { type: 'push', entry: b });
    const result = overlayReducer(withB, { type: 'pop', id: 'a' });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('b');
  });

  it('clears all entries', () => {
    const a = makeEntry({ priority: 50 });
    const b = makeEntry({ priority: 60 });
    const stack = overlayReducer(
      overlayReducer([], { type: 'push', entry: a }),
      { type: 'push', entry: b },
    );
    expect(overlayReducer(stack, { type: 'clear' })).toEqual([]);
  });

  it('deduplicates by id on push', () => {
    const entry = makeEntry({ id: 'same', priority: 50 });
    const result = overlayReducer(
      [entry],
      { type: 'push', entry: { ...entry, priority: 60 } },
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.priority).toBe(60);
  });

  it('handles concurrent push while dismissing', () => {
    const a = makeEntry({ id: 'a', priority: 50 });
    const b = makeEntry({ id: 'b', priority: 60 });
    const pushed = overlayReducer([a], { type: 'push', entry: b });
    const popped = overlayReducer(pushed, { type: 'pop', id: 'a' });
    expect(popped).toHaveLength(1);
    expect(popped[0]!.id).toBe('b');
  });

  it('rehydrates from server state', () => {
    const entries = [
      makeEntry({ id: 'r1', type: 'trust-recovery', priority: 60 }),
      makeEntry({ id: 'r2', type: 'trust-recovery', priority: 60 }),
    ];
    const result = overlayReducer([], { type: 'rehydrate', entries });
    expect(result).toHaveLength(2);
  });

  it('queue drains correctly', () => {
    const a = makeEntry({ id: 'a', priority: 60, type: 'trust-recovery' });
    const b = makeEntry({ id: 'b', priority: 50, type: 'trust-ceremony' });
    const c = makeEntry({ id: 'c', priority: 30, type: 'trust-milestone' });
    let state = overlayReducer([], { type: 'push', entry: a });
    state = overlayReducer(state, { type: 'push', entry: b });
    state = overlayReducer(state, { type: 'push', entry: c });
    expect(state[0]!.id).toBe('a');
    state = overlayReducer(state, { type: 'pop', id: 'a' });
    expect(state[0]!.id).toBe('b');
    state = overlayReducer(state, { type: 'pop', id: 'b' });
    expect(state[0]!.id).toBe('c');
    state = overlayReducer(state, { type: 'pop', id: 'c' });
    expect(state).toHaveLength(0);
  });

  it('replaces same-type entry on push', () => {
    const a = makeEntry({ id: 'a', type: 'trust-ceremony', priority: 50 });
    const a2 = makeEntry({ id: 'a', type: 'trust-ceremony', priority: 50, props: { updated: true } });
    const result = overlayReducer([a], { type: 'push', entry: a2 });
    expect(result).toHaveLength(1);
    expect(result[0]!.props.updated).toBe(true);
  });

  it('maintains priority ordering across 6 permutations', () => {
    const permutations: number[][] = [
      [30, 50, 60],
      [60, 30, 50],
      [50, 60, 30],
      [30, 60, 50],
      [60, 50, 30],
      [50, 30, 60],
    ];
    for (const order of permutations) {
      let state: OverlayEntry[] = [];
      for (const p of order) {
        state = overlayReducer(state, {
          type: 'push',
          entry: makeEntry({ id: `e${p}`, priority: p }),
        });
      }
      expect(state.map((e) => e.priority)).toEqual([60, 50, 30]);
    }
  });

  it('pop on empty stack returns empty', () => {
    expect(overlayReducer([], { type: 'pop', id: 'none' })).toEqual([]);
  });

  it('pop on non-existent id returns stack unchanged', () => {
    const a = makeEntry({ id: 'a', priority: 50 });
    const result = overlayReducer([a], { type: 'pop', id: 'ghost' });
    expect(result).toHaveLength(1);
  });
});

describe('topOverlayAtom', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it('returns null when stack is empty', () => {
    expect(store.get(topOverlayAtom)).toBeNull();
  });

  it('returns highest priority entry', () => {
    const a = makeEntry({ id: 'a', priority: 30 });
    const b = makeEntry({ id: 'b', priority: 60 });
    store.set(overlayStackAtom, { type: 'push', entry: a });
    store.set(overlayStackAtom, { type: 'push', entry: b });
    expect(store.get(topOverlayAtom)?.id).toBe('b');
  });

  it('updates when top entry is popped', () => {
    const a = makeEntry({ id: 'a', priority: 60 });
    const b = makeEntry({ id: 'b', priority: 30 });
    store.set(overlayStackAtom, { type: 'push', entry: a });
    store.set(overlayStackAtom, { type: 'push', entry: b });
    store.set(overlayStackAtom, { type: 'pop', id: 'a' });
    expect(store.get(topOverlayAtom)?.id).toBe('b');
  });

  it('returns null after clear', () => {
    const a = makeEntry({ priority: 50 });
    store.set(overlayStackAtom, { type: 'push', entry: a });
    store.set(overlayStackAtom, { type: 'clear' });
    expect(store.get(topOverlayAtom)).toBeNull();
  });

  it('atom state consistency after multiple pushes', () => {
    const entries = [
      makeEntry({ id: '1', priority: 30 }),
      makeEntry({ id: '2', priority: 60 }),
      makeEntry({ id: '3', priority: 50 }),
    ];
    for (const e of entries) {
      store.set(overlayStackAtom, { type: 'push', entry: e });
    }
    const stack = store.get(overlayStackAtom);
    expect(stack).toHaveLength(3);
    expect(stack[0]!.priority).toBe(60);
    expect(stack[1]!.priority).toBe(50);
    expect(stack[2]!.priority).toBe(30);
  });

  it('no-overlay idle state', () => {
    expect(store.get(overlayStackAtom)).toEqual([]);
    expect(store.get(topOverlayAtom)).toBeNull();
  });
});
