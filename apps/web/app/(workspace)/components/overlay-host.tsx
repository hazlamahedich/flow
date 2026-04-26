'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import {
  topOverlayAtom,
  overlayStackAtom,
  type OverlayEntry,
  type OverlayAction,
} from '@/lib/atoms/overlay';
import { TrustCeremony } from '../agents/components/trust-ceremony';
import { TrustRecovery } from '../agents/components/trust-recovery';
import { TrustMilestone } from '../agents/components/trust-milestone';
import { fetchUnacknowledgedRegressions } from '../agents/actions/rehydrate-regressions';

const OVERLAY_REGISTRY: Record<string, React.ComponentType<{ entry: OverlayEntry }>> = {
  'trust-ceremony': TrustCeremony,
  'trust-recovery': TrustRecovery,
  'trust-milestone': TrustMilestone,
};

const MERGE_WINDOW_MS = 1000;

export function useOverlayMerger() {
  const [stack, dispatch] = useAtom(overlayStackAtom);
  const lastRegressionRef = useRef<{ agentId: string; time: number } | null>(null);

  useEffect(() => {
    const top = stack[0];
    if (!top) return;

    if (top.type === 'trust-recovery') {
      const agentId = top.props.agentId as string | undefined;
      if (agentId) {
        lastRegressionRef.current = { agentId, time: Date.now() };
      }
    }

    if (top.type === 'trust-milestone' && stack.length > 1) {
      const milestoneAgentId = top.props.agentId as string | undefined;
      const regression = lastRegressionRef.current;
      if (
        milestoneAgentId &&
        regression &&
        regression.agentId === milestoneAgentId &&
        Date.now() - regression.time < MERGE_WINDOW_MS
      ) {
        const milestoneId = top.id;
        const regressionEntry = stack.find(
          (e) => e.type === 'trust-recovery' && e.props.agentId === milestoneAgentId,
        );
        if (regressionEntry) {
          const mergedEntry: OverlayEntry = {
            id: `merged-${Date.now()}`,
            type: 'trust-recovery',
            priority: 60,
            props: {
              ...regressionEntry.props,
              mergedMilestone: top.props.milestoneType,
              mergedMilestoneMarker: top.props.milestoneMarker,
            },
            createdAt: Date.now(),
          };
          const actions: OverlayAction[] = [
            { type: 'pop', id: milestoneId },
            { type: 'pop', id: regressionEntry.id },
            { type: 'push', entry: mergedEntry },
          ];
          for (const action of actions) {
            dispatch(action);
          }
        }
      }
    }
  }, [stack, dispatch]);
}

export function OverlayHost() {
  const topOverlay = useAtomValue(topOverlayAtom);
  const [, dispatch] = useAtom(overlayStackAtom);

  useOverlayMerger();

  useEffect(() => {
    let cancelled = false;
    async function rehydrate() {
      const result = await fetchUnacknowledgedRegressions();
      if (cancelled || !result.success || result.data.length === 0) return;

      const entries: OverlayEntry[] = result.data.map((r) => ({
        id: `rehydration-${r.id}`,
        type: 'trust-recovery' as const,
        priority: 60,
        props: {
          matrixEntryId: r.matrixEntryId,
          transitionId: r.transitionId,
          agentId: r.agentId,
          agentLabel: r.agentLabel,
          triggerReason: r.triggerReason,
          fromLevel: r.fromLevel,
          toLevel: r.toLevel,
          expectedVersion: r.expectedVersion,
          isAutoTriggered: r.isAutoTriggered,
          isRehydration: true,
        },
        createdAt: Date.now(),
      }));
      dispatch({ type: 'rehydrate', entries });
    }
    rehydrate();
    return () => { cancelled = true; };
  }, [dispatch]);

  if (!topOverlay) return null;

  const Component = OVERLAY_REGISTRY[topOverlay.type];
  if (!Component) return null;

  return (
    <div
      style={{ zIndex: 'var(--flow-z-overlay)' }}
      className="fixed inset-0"
      aria-modal={
        topOverlay.type === 'trust-ceremony' || topOverlay.type === 'trust-recovery'
          ? true
          : undefined
      }
    >
      <Component entry={topOverlay} />
    </div>
  );
}
