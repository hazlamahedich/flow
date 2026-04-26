import { atom, type Atom } from 'jotai';
import type { AgentId } from '@flow/types';
import type { TrustBadgeState } from '@flow/trust';

export interface TrustBadgeData {
  agentId: AgentId;
  state: TrustBadgeState;
  score: number;
  consecutiveSuccesses: number;
  totalExecutions: number;
  daysAtLevel: number;
}

export const trustBadgeMapAtom = atom<Map<string, TrustBadgeData>>(new Map());

const atomCache = new Map<string, Atom<TrustBadgeData | null>>();

export function trustBadgeAtom(workspaceId: string, agentId: AgentId) {
  const key = `${workspaceId}:${agentId}`;
  const cached = atomCache.get(key);
  if (cached) return cached;
  const derived: Atom<TrustBadgeData | null> = atom((get) => {
    const map = get(trustBadgeMapAtom);
    return map.get(key) ?? null;
  });
  atomCache.set(key, derived);
  return derived;
}

export const dominantTrustTierAtom = atom<TrustBadgeState | null>((get) => {
  const map = get(trustBadgeMapAtom);
  const priority: TrustBadgeState[] = ['regressing', 'supervised', 'promoting', 'confirm', 'stick_time', 'auto'];
  for (const tier of priority) {
    for (const data of map.values()) {
      if (data.state === tier) return tier;
    }
  }
  return null;
});
