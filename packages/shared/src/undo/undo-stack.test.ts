import { describe, it, expect } from 'vitest';
import {
  createUndoStackActions,
  createEmptyStack,
  pruneExpired,
  measureSnapshot,
} from './undo-stack';
import { UNDO_MAX_ENTRIES, UNDO_WINDOW_MS } from './types';
import type { UndoEntry } from './types';

const WORKSPACE_ID = 'ws-test-123';

function makeEntry(overrides: Partial<UndoEntry> = {}): UndoEntry {
  return {
    id: 'entry-1',
    operationId: 'op-1',
    actionType: 'update',
    severity: 'whisper',
    irreversible: false,
    entityType: 'client',
    entityId: 'entity-1',
    description: 'Updated client name',
    snapshot: { name: 'Before' },
    expectedVersion: 1,
    workspaceId: WORKSPACE_ID,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('undo-stack', () => {
  const actions = createUndoStackActions(WORKSPACE_ID);

  describe('createEmptyStack', () => {
    it('returns empty stack with correct defaults', () => {
      const stack = createEmptyStack();
      expect(stack.entries).toEqual([]);
      expect(stack.maxEntries).toBe(UNDO_MAX_ENTRIES);
      expect(stack.maxAgeMs).toBe(UNDO_WINDOW_MS);
    });
  });

  describe('addEntry', () => {
    it('adds entry to empty stack', () => {
      const stacks = new Map();
      const entry = makeEntry();
      const result = actions.addEntry(stacks, entry);
      const stack = actions.getStack(result);
      expect(stack.entries).toHaveLength(1);
      expect(stack.entries[0].id).toBe('entry-1');
    });

    it('limits entries to max', () => {
      let stacks = new Map();
      for (let i = 0; i < 15; i++) {
        stacks = actions.addEntry(stacks, makeEntry({ id: `entry-${i}`, operationId: `op-${i}` }));
      }
      const stack = actions.getStack(stacks);
      expect(stack.entries).toHaveLength(UNDO_MAX_ENTRIES);
      expect(stack.entries[0].id).toBe('entry-14');
    });

    it('marks entries with oversized snapshots as irreversible', () => {
      const largeSnapshot: Record<string, unknown> = {};
      for (let i = 0; i < 500; i++) {
        largeSnapshot[`field_${i}`] = `value_${'_'.repeat(10)}`;
      }
      const stacks = new Map();
      const entry = makeEntry({ snapshot: largeSnapshot });
      const result = actions.addEntry(stacks, entry);
      const stack = actions.getStack(result);
      expect(stack.entries[0].irreversible).toBe(true);
      expect(stack.entries[0].snapshot).toEqual({});
    });
  });

  describe('popEntry', () => {
    it('pops most recent entry', () => {
      let stacks = new Map();
      stacks = actions.addEntry(stacks, makeEntry({ id: 'first' }));
      stacks = actions.addEntry(stacks, makeEntry({ id: 'second', operationId: 'op-2' }));
      const { stacks: next, entry } = actions.popEntry(stacks);
      expect(entry?.id).toBe('second');
      expect(actions.getStack(next).entries).toHaveLength(1);
    });

    it('returns undefined for empty stack', () => {
      const stacks = new Map();
      const { entry } = actions.popEntry(stacks);
      expect(entry).toBeUndefined();
    });
  });

  describe('clearStack', () => {
    it('removes all entries', () => {
      let stacks = new Map();
      stacks = actions.addEntry(stacks, makeEntry());
      stacks = actions.addEntry(stacks, makeEntry({ id: 'e2', operationId: 'op-2' }));
      const result = actions.clearStack(stacks);
      expect(actions.getStack(result).entries).toHaveLength(0);
    });
  });

  describe('pruneExpired', () => {
    it('removes entries older than 30s', () => {
      const now = Date.now();
      const entries: UndoEntry[] = [
        makeEntry({ id: 'old', createdAt: now - UNDO_WINDOW_MS - 1000 }),
        makeEntry({ id: 'recent', createdAt: now - 1000, operationId: 'op-2' }),
      ];
      const pruned = pruneExpired(entries, now);
      expect(pruned).toHaveLength(1);
      expect(pruned[0].id).toBe('recent');
    });

    it('keeps entries within window', () => {
      const now = Date.now();
      const entries: UndoEntry[] = [
        makeEntry({ id: 'e1', createdAt: now - 1000 }),
        makeEntry({ id: 'e2', createdAt: now - 5000, operationId: 'op-2' }),
      ];
      const pruned = pruneExpired(entries, now);
      expect(pruned).toHaveLength(2);
    });
  });

  describe('workspace isolation', () => {
    it('entries from different workspaces are isolated', () => {
      const ws1 = createUndoStackActions('ws-1');
      const ws2 = createUndoStackActions('ws-2');
      let stacks = new Map();
      stacks = ws1.addEntry(stacks, makeEntry({ workspaceId: 'ws-1' }));
      stacks = ws2.addEntry(stacks, makeEntry({ workspaceId: 'ws-2', id: 'e2', operationId: 'op-2' }));
      expect(ws1.getStack(stacks).entries).toHaveLength(1);
      expect(ws2.getStack(stacks).entries).toHaveLength(1);
    });
  });

  describe('measureSnapshot', () => {
    it('measures small snapshot under 4KB', () => {
      const size = measureSnapshot({ name: 'test' });
      expect(size).toBeLessThan(4096);
    });

    it('measures large snapshot over 4KB', () => {
      const large: Record<string, unknown> = {};
      for (let i = 0; i < 500; i++) {
        large[`field_${i}`] = `value_${'_'.repeat(10)}`;
      }
      const size = measureSnapshot(large);
      expect(size).toBeGreaterThan(4096);
    });
  });
});
