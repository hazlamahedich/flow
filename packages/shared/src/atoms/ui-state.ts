import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export const sidebarCollapsedAtom = atomWithStorage<boolean>(
  'flow-sidebar-collapsed',
  false,
  {
    getItem: (key) => {
      if (typeof window === 'undefined') return false;
      const stored = window.localStorage.getItem(key);
      if (stored === null) return false;
      try {
        return JSON.parse(stored) as boolean;
      } catch {
        return false;
      }
    },
    setItem: (key, value) => {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    removeItem: (key) => {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
    },
  },
);

export const sidebarHoverExpandedAtom = atom<boolean>(false);
