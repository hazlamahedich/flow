'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import {
  commandPaletteOpenAtom,
  shortcutOverlayOpenAtom,
  createShortcutRegistry,
  getDefaultShortcuts,
  isInputFocused,
  hasModifierKey,
  isImeComposing,
} from '@flow/shared';
import type { ShortcutRegistry } from '@flow/shared';

let globalRegistry: ShortcutRegistry | null = null;

export function getShortcutRegistry(): ShortcutRegistry {
  if (!globalRegistry) {
    globalRegistry = createShortcutRegistry();
  }
  return globalRegistry;
}

export function resetShortcutRegistry(): void {
  globalRegistry = null;
}

interface KeyboardListenerProps {
  onToggleSidebar?: (collapsed: boolean) => void;
}

export function KeyboardListener({ onToggleSidebar }: KeyboardListenerProps) {
  const [paletteOpen, setPaletteOpen] = useAtom(commandPaletteOpenAtom);
  const [overlayOpen, setOverlayOpen] = useAtom(shortcutOverlayOpenAtom);
  const onToggleSidebarRef = useRef(onToggleSidebar);
  onToggleSidebarRef.current = onToggleSidebar;

  const registry = useMemo(() => getShortcutRegistry(), []);

  const togglePalette = useCallback(() => {
    setPaletteOpen((prev) => !prev);
  }, [setPaletteOpen]);

  const toggleOverlay = useCallback(() => {
    setOverlayOpen((prev) => !prev);
  }, [setOverlayOpen]);

  const expandSidebar = useCallback(() => {
    onToggleSidebarRef.current?.(false);
  }, []);

  const collapseSidebar = useCallback(() => {
    onToggleSidebarRef.current?.(true);
  }, []);

  useEffect(() => {
    const defaults = getDefaultShortcuts({
      togglePalette,
      toggleShortcutOverlay: toggleOverlay,
      expandSidebar,
      collapseSidebar,
    });

    const ids = defaults.map((s) => registry.register(s));

    return () => {
      ids.forEach((id) => registry.unregister(id));
    };
  }, [registry, togglePalette, toggleOverlay, expandSidebar, collapseSidebar]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey;
      if (isModifier && e.key === 'k' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        togglePalette();
        return;
      }

      if (paletteOpen || overlayOpen) return;

      if (isInputFocused(e.target) && !hasModifierKey(e)) return;
      if (isImeComposing(e)) return;

      const resolved = registry.resolve(e);
      if (resolved) {
        resolved.action(e);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [registry, paletteOpen, overlayOpen, togglePalette]);

  const hasPhysicalKeyboard = usePhysicalKeyboard();

  if (!hasPhysicalKeyboard) return null;

  return null;
}

function usePhysicalKeyboard(): boolean {
  const [hasKeyboard, setHasKeyboard] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(pointer: fine)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(pointer: fine)');
    const handler = (e: MediaQueryListEvent) => setHasKeyboard(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return hasKeyboard;
}
