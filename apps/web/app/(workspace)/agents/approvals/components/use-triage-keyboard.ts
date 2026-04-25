'use client';

import { useState, useCallback, useRef } from 'react';

type TriageMode = 'navigate' | 'edit' | 'batch';

interface UseTriageKeyboardOptions {
  itemIds: string[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onBatchApprove: (ids: string[]) => void;
  onBatchReject: (ids: string[]) => void;
  onEdit: (id: string) => void;
  onExpand: (id: string) => void;
  onModeChange?: (mode: TriageMode) => void;
}

interface UseTriageKeyboardReturn {
  mode: TriageMode;
  focusedItemId: string | null;
  selectedItemIds: Set<string>;
  expandedItemId: string | null;
  modeIndicator: string;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  setFocusedItemId: (id: string | null) => void;
  setMode: (mode: TriageMode) => void;
  setExpandedItemId: (id: string | null) => void;
}

export function useTriageKeyboard({
  itemIds,
  onApprove,
  onReject,
  onBatchApprove,
  onBatchReject,
  onEdit,
  onExpand,
  onModeChange,
}: UseTriageKeyboardOptions): UseTriageKeyboardReturn {
  const [mode, setModeState] = useState<TriageMode>('navigate');
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const itemIdsRef = useRef(itemIds);
  itemIdsRef.current = itemIds;

  const setMode = useCallback((newMode: TriageMode) => {
    setModeState(newMode);
    if (newMode === 'navigate') {
      setSelectedItemIds(new Set());
    }
    onModeChange?.(newMode);
  }, [onModeChange]);

  const getAdjacentId = useCallback((direction: 'next' | 'prev') => {
    const ids = itemIdsRef.current;
    if (ids.length === 0) return null;
    const currentIdx = focusedItemId ? ids.indexOf(focusedItemId) : -1;

    if (direction === 'next') {
      if (currentIdx === -1 || currentIdx >= ids.length - 1) {
        return ids[0] ?? null;
      }
      return ids[currentIdx + 1] ?? null;
    }

    if (direction === 'prev') {
      if (currentIdx <= 0) {
        return ids[ids.length - 1] ?? null;
      }
      return ids[currentIdx - 1] ?? null;
    }
    return null;
  }, [focusedItemId]);

  const getNextPendingId = useCallback((afterId: string) => {
    const ids = itemIdsRef.current;
    const idx = ids.indexOf(afterId);
    if (idx === -1) return ids[0] ?? null;
    if (idx < ids.length - 1) return ids[idx + 1] ?? null;
    if (idx > 0) return ids[idx - 1] ?? null;
    return null;
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (mode === 'edit') {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMode('navigate');
      }
      return;
    }

    const activeId = focusedItemId;
    if (!activeId && itemIdsRef.current.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setFocusedItemId(itemIdsRef.current[0] ?? null);
      return;
    }

    if (!activeId) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (e.shiftKey && mode === 'batch') {
          const nextId = getAdjacentId('next');
          if (nextId) {
            setSelectedItemIds((prev) => {
              const next = new Set(prev);
              if (next.has(nextId)) next.delete(nextId);
              else next.add(nextId);
              return next;
            });
            setFocusedItemId(nextId);
          }
        } else {
          setFocusedItemId(getAdjacentId('next'));
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (e.shiftKey && mode === 'batch') {
          const prevId = getAdjacentId('prev');
          if (prevId) {
            setSelectedItemIds((prev) => {
              const next = new Set(prev);
              if (next.has(prevId)) next.delete(prevId);
              else next.add(prevId);
              return next;
            });
            setFocusedItemId(prevId);
          }
        } else {
          setFocusedItemId(getAdjacentId('prev'));
        }
        break;
      }
      case 'a': case 'A': {
        if (e.shiftKey && mode === 'batch' && selectedItemIds.size > 0) {
          e.preventDefault();
          onBatchApprove([...selectedItemIds]);
          setMode('navigate');
          const nextId = getNextPendingId(activeId);
          setFocusedItemId(nextId);
        } else if (!e.shiftKey && mode === 'navigate') {
          e.preventDefault();
          onApprove(activeId);
          setFocusedItemId(getNextPendingId(activeId));
        }
        break;
      }
      case 'r': case 'R': {
        if (e.shiftKey && mode === 'batch' && selectedItemIds.size > 0) {
          e.preventDefault();
          onBatchReject([...selectedItemIds]);
          setMode('navigate');
          const nextId = getNextPendingId(activeId);
          setFocusedItemId(nextId);
        } else if (!e.shiftKey && mode === 'navigate') {
          e.preventDefault();
          onReject(activeId);
          setFocusedItemId(getNextPendingId(activeId));
        }
        break;
      }
      case 'e': case 'E': {
        if (mode === 'navigate') {
          e.preventDefault();
          setMode('edit');
          onEdit(activeId);
        }
        break;
      }
      case 'Tab': {
        if (mode === 'navigate') {
          e.preventDefault();
          setExpandedItemId((prev) => prev === activeId ? null : activeId);
          onExpand(activeId);
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        if (mode === 'batch') {
          setSelectedItemIds(new Set());
          setMode('navigate');
        }
        break;
      }
      default: {
        if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && mode !== 'batch') {
          setMode('batch');
        }
        break;
      }
    }
  }, [mode, focusedItemId, selectedItemIds, getAdjacentId, getNextPendingId, onApprove, onReject, onBatchApprove, onBatchReject, onEdit, onExpand, setMode]);

  const modeIndicator = mode === 'navigate'
    ? 'Navigate'
    : mode === 'edit'
      ? 'Editing'
      : `${selectedItemIds.size} selected`;

  return {
    mode,
    focusedItemId,
    selectedItemIds,
    expandedItemId,
    modeIndicator,
    handleKeyDown,
    setFocusedItemId,
    setMode,
    setExpandedItemId,
  };
}
