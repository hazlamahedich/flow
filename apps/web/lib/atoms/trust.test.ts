import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from 'jotai';
import { trustBadgeMapAtom, trustBadgeAtom, dominantTrustTierAtom } from './trust';
import type { TrustBadgeData } from './trust';
import type { AgentId } from '@flow/types';
import type { TrustBadgeState } from '@flow/trust';

function makeBadgeData(overrides: Partial<TrustBadgeData> = {}): TrustBadgeData {
  return {
    agentId: 'inbox' as AgentId,
    state: 'supervised' as TrustBadgeState,
    score: 0,
    consecutiveSuccesses: 0,
    totalExecutions: 0,
    daysAtLevel: 0,
    ...overrides,
  };
}

describe('trust atoms', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe('trustBadgeMapAtom', () => {
    it('initializes as empty Map', () => {
      const map = store.get(trustBadgeMapAtom);
      expect(map.size).toBe(0);
    });

    it('stores badge data with composite key', () => {
      const data = makeBadgeData({ agentId: 'inbox', state: 'supervised', score: 50 });
      const map = new Map([['ws-1:inbox', data]]);
      store.set(trustBadgeMapAtom, map);
      expect(store.get(trustBadgeMapAtom).get('ws-1:inbox')).toEqual(data);
    });

    it('overwrites entire map on set', () => {
      store.set(trustBadgeMapAtom, new Map([['ws-1:inbox', makeBadgeData({ score: 10 })]]));
      store.set(trustBadgeMapAtom, new Map([['ws-1:calendar', makeBadgeData({ agentId: 'calendar', score: 20 })]]));
      const map = store.get(trustBadgeMapAtom);
      expect(map.size).toBe(1);
      expect(map.get('ws-1:calendar')?.score).toBe(20);
    });
  });

  describe('trustBadgeAtom (derived)', () => {
    it('returns null when no data for agent', () => {
      store.set(trustBadgeMapAtom, new Map());
      const atom = trustBadgeAtom('ws-1', 'inbox');
      expect(store.get(atom)).toBeNull();
    });

    it('returns badge data when exists', () => {
      const data = makeBadgeData({ agentId: 'inbox', state: 'confirm', score: 80 });
      store.set(trustBadgeMapAtom, new Map([['ws-1:inbox', data]]));
      const atom = trustBadgeAtom('ws-1', 'inbox');
      expect(store.get(atom)).toEqual(data);
    });

    it('isolates by workspace', () => {
      const data = makeBadgeData({ agentId: 'inbox', state: 'auto', score: 150 });
      store.set(trustBadgeMapAtom, new Map([['ws-1:inbox', data]]));
      const otherAtom = trustBadgeAtom('ws-2', 'inbox');
      expect(store.get(otherAtom)).toBeNull();
    });
  });

  describe('dominantTrustTierAtom', () => {
    it('returns null when no agents', () => {
      store.set(trustBadgeMapAtom, new Map());
      expect(store.get(dominantTrustTierAtom)).toBeNull();
    });

    it('returns regressing as highest priority', () => {
      const map = new Map([
        ['ws-1:inbox', makeBadgeData({ agentId: 'inbox', state: 'auto' })],
        ['ws-1:calendar', makeBadgeData({ agentId: 'calendar', state: 'regressing' })],
      ]);
      store.set(trustBadgeMapAtom, map);
      expect(store.get(dominantTrustTierAtom)).toBe('regressing');
    });

    it('returns supervised over confirm', () => {
      const map = new Map([
        ['ws-1:inbox', makeBadgeData({ agentId: 'inbox', state: 'supervised' })],
        ['ws-1:calendar', makeBadgeData({ agentId: 'calendar', state: 'confirm' })],
      ]);
      store.set(trustBadgeMapAtom, map);
      expect(store.get(dominantTrustTierAtom)).toBe('supervised');
    });

    it('returns auto when all agents are auto', () => {
      const map = new Map([
        ['ws-1:inbox', makeBadgeData({ agentId: 'inbox', state: 'auto' })],
        ['ws-1:calendar', makeBadgeData({ agentId: 'calendar', state: 'auto' })],
      ]);
      store.set(trustBadgeMapAtom, map);
      expect(store.get(dominantTrustTierAtom)).toBe('auto');
    });

    it('returns stick_time when all agents are at stick_time or auto', () => {
      const map = new Map([
        ['ws-1:inbox', makeBadgeData({ agentId: 'inbox', state: 'stick_time' })],
        ['ws-1:calendar', makeBadgeData({ agentId: 'calendar', state: 'auto' })],
      ]);
      store.set(trustBadgeMapAtom, map);
      expect(store.get(dominantTrustTierAtom)).toBe('stick_time');
    });
  });

  describe('default fallback', () => {
    it('trustBadgeAtom returns null for unknown agent', () => {
      const data = makeBadgeData({ agentId: 'inbox' });
      store.set(trustBadgeMapAtom, new Map([['ws-1:inbox', data]]));
      const atom = trustBadgeAtom('ws-1', 'calendar');
      expect(store.get(atom)).toBeNull();
    });
  });
});
