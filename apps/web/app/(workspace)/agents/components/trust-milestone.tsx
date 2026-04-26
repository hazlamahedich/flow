'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { overlayStackAtom, type OverlayEntry } from '@/lib/atoms/overlay';
import { useTrustAnnouncer } from '@/lib/hooks/use-trust-announcer';
import {
  MILESTONE_COPY,
  AUTO_DISMISS_MILESTONE_MS,
  type MilestoneType,
} from '../constants/trust-copy';

interface TrustMilestoneProps {
  entry: OverlayEntry;
}

export function TrustMilestone({ entry }: TrustMilestoneProps) {
  const {
    agentLabel = '',
    milestoneType = '',
  } = entry.props as Record<string, unknown>;

  const [, dispatch] = useAtom(overlayStackAtom);
  const announce = useTrustAnnouncer();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);
  const remainingRef = useRef(AUTO_DISMISS_MILESTONE_MS);
  const startRef = useRef(Date.now());

  const close = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    dispatch({ type: 'pop', id: entry.id });
  }, [dispatch, entry.id]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    startRef.current = Date.now();
    timerRef.current = setTimeout(close, remainingRef.current);
  }, [close, remainingRef]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (timerRef.current) clearTimeout(timerRef.current);
        const elapsed = Date.now() - startRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
        pausedRef.current = true;
      } else if (pausedRef.current) {
        pausedRef.current = false;
        startTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [startTimer]);

  const milestone = MILESTONE_COPY[milestoneType as MilestoneType];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    },
    [close],
  );

  useEffect(() => {
    if (!milestone) return;
    announce(`${milestone.marker}. ${String(agentLabel)}`, 'polite');
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startTimer, milestone, announce, agentLabel]);

  if (!milestone) return null;

  return (
    <div
      onKeyDown={handleKeyDown}
      className="motion-reduce:transition-none motion-reduce:animate-none fixed bottom-6 right-6 animate-[fade-in_300ms_ease-out] rounded-lg border-2 border-yellow-500/30 bg-[var(--flow-color-bg-surface-raised)] p-4 shadow-xl"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-yellow-500 bg-yellow-500/10">
          <span className="text-lg" aria-hidden="true">★</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--flow-color-text-primary)]">
            {milestone.marker}
          </p>
          <p className="text-xs text-[var(--flow-color-text-tertiary)]">
            {String(agentLabel)} · {milestone.label}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={close}
        className="absolute right-2 top-2 text-[var(--flow-color-text-tertiary)] hover:text-[var(--flow-color-text-primary)]"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
