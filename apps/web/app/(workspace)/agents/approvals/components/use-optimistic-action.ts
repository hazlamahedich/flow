'use client';

import { useOptimistic, useCallback, useRef } from 'react';
import type { AgentRunStatus } from '@flow/types';

interface OptimisticItem {
  runId: string;
  status: AgentRunStatus;
}

interface Snapshot {
  runId: string;
  status: AgentRunStatus;
}

interface UseOptimisticActionOptions {
  items: OptimisticItem[];
  actionFn: (runId: string) => Promise<{ success: boolean; data?: { alreadyProcessed?: boolean }; error?: { message: string } }>;
  onError: (runId: string, message: string) => void;
}

export function useOptimisticAction({
  items,
  actionFn,
  onError,
}: UseOptimisticActionOptions) {
  const snapshotsRef = useRef<Map<string, Snapshot>>(new Map());
  const lastActionTimeRef = useRef<number>(0);

  const [optimisticItems, addOptimisticUpdate] = useOptimistic(
    items,
    (state, update: { runId: string; newStatus: AgentRunStatus }) => {
      return state.map((item) =>
        item.runId === update.runId ? { ...item, status: update.newStatus } : item,
      );
    },
  );

  const execute = useCallback(async (runId: string, optimisticStatus: AgentRunStatus) => {
    const current = items.find((i) => i.runId === runId);
    if (!current) return;

    snapshotsRef.current.set(runId, { runId, status: current.status });

    const now = Date.now();
    const isRapid = now - lastActionTimeRef.current < 200;
    lastActionTimeRef.current = now;

    if (!isRapid) {
      addOptimisticUpdate({ runId, newStatus: optimisticStatus });
    }

    try {
      const result = await actionFn(runId);

      if (result.success) {
        snapshotsRef.current.delete(runId);
      } else {
        const snapshot = snapshotsRef.current.get(runId);
        if (snapshot) {
          addOptimisticUpdate({ runId: snapshot.runId, newStatus: snapshot.status });
          snapshotsRef.current.delete(runId);
        }
        if (result.error?.message) {
          onError(runId, result.error.message);
        }
      }
    } catch {
      const snapshot = snapshotsRef.current.get(runId);
      if (snapshot) {
        addOptimisticUpdate({ runId: snapshot.runId, newStatus: snapshot.status });
        snapshotsRef.current.delete(runId);
      }
      onError(runId, 'Network error');
    }
  }, [items, actionFn, onError, addOptimisticUpdate]);

  return { optimisticItems, execute };
}
