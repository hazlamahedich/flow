'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { overlayStackAtom, type OverlayEntry } from '@/lib/atoms/overlay';
import { trustBadgeAnimationAtom } from '@/lib/atoms/trust';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import { useTrustAnnouncer } from '@/lib/hooks/use-trust-announcer';
import {
  CEREMONY_COPY,
  AUTO_DISMISS_TOAST_MS,
  CEREMONY_BADGE_PULSE_MS,
  CELEBRATION_DURATION_MS,
} from '../constants/trust-copy';
import {
  CeremonyStepAcknowledge,
  CeremonyStepConfirm,
  CeremonyStepStats,
} from './trust-ceremony-steps';
import { upgradeTrustLevel } from '../actions/trust-actions';

const triggerElMap = new WeakMap<OverlayEntry, HTMLElement>();

export function registerTriggerElement(entry: OverlayEntry, el: HTMLElement) {
  triggerElMap.set(entry, el);
}

interface TrustCeremonyProps {
  entry: OverlayEntry;
}

export function TrustCeremony({ entry }: TrustCeremonyProps) {
  const {
    agentLabel = '',
    actionLabel = '',
    cleanApprovals = 0,
    totalRuns = 0,
    daysAtLevel = 0,
    fromLevel = '',
    toLevel = '',
    expectedVersion = 1,
    matrixEntryId = '',
  } = entry.props as Record<string, unknown>;

  const [, dispatch] = useAtom(overlayStackAtom);
  const [, setAnim] = useAtom(trustBadgeAnimationAtom);
  const announce = useTrustAnnouncer();
  const declineRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);
  const remainingRef = useRef(AUTO_DISMISS_TOAST_MS);
  const startRef = useRef(Date.now());
  const [state, setState] = useState<'idle' | 'submitting' | 'celebrating' | 'error'>('idle');

  const triggerEl = triggerElMap.get(entry) ?? null;
  const { containerRef, activate, deactivate } = useFocusTrap(triggerEl);

  const close = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    deactivate();
    dispatch({ type: 'pop', id: entry.id });
  }, [deactivate, dispatch, entry.id]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    startRef.current = Date.now();
    timerRef.current = setTimeout(() => { close(); }, remainingRef.current);
  }, [close, remainingRef]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      setAnim('pulse-promoting');
      const pulseTimer = setTimeout(() => setAnim('default'), CEREMONY_BADGE_PULSE_MS);
      return () => clearTimeout(pulseTimer);
    }
  }, [setAnim]);

  const startTimerRef = useRef(startTimer);
  startTimerRef.current = startTimer;
  const activateRef = useRef(activate);
  activateRef.current = activate;
  const announceRef = useRef(announce);
  announceRef.current = announce;
  const labelRef = useRef(String(agentLabel));
  labelRef.current = String(agentLabel);

  useEffect(() => {
    activateRef.current();
    announceRef.current(CEREMONY_COPY.upgrade.escapeInstruction, 'polite');
    announceRef.current(CEREMONY_COPY.upgrade.title(labelRef.current), 'polite');
    startTimerRef.current();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (timerRef.current) clearTimeout(timerRef.current);
        const elapsed = Date.now() - startRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
        pausedRef.current = true;
      } else if (pausedRef.current) {
        pausedRef.current = false;
        startTimerRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const handleAccept = useCallback(async () => {
    if (state !== 'idle') return;
    setState('submitting');
    if (timerRef.current) clearTimeout(timerRef.current);
    const result = await upgradeTrustLevel({
      matrixEntryId: String(matrixEntryId),
      fromLevel: String(fromLevel),
      toLevel: String(toLevel),
      expectedVersion: Number(expectedVersion),
    });
    if (result.success) {
      setState('celebrating');
      setTimeout(close, CELEBRATION_DURATION_MS);
    } else {
      setState('error');
      startTimerRef.current();
    }
  }, [close, state, matrixEntryId, fromLevel, toLevel, expectedVersion]);

  const handleDecline = useCallback(() => {
    if (state === 'submitting') return;
    close();
  }, [close, state]);

  const handleRemindLater = useCallback(() => {
    if (state === 'submitting') return;
    close();
    const { triggerElement: _, ...cleanProps } = entry.props as Record<string, unknown>;
    setTimeout(() => {
      const newId = `remind-${Date.now()}`;
      const newEntry: OverlayEntry = { ...entry, id: newId, props: cleanProps, createdAt: Date.now() };
      const triggerEl = triggerElMap.get(entry);
      if (triggerEl) triggerElMap.set(newEntry, triggerEl);
      dispatch({ type: 'push', entry: newEntry });
    }, 3_600_000);
  }, [close, dispatch, entry, state]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (state === 'submitting') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (document.activeElement === declineRef.current) {
          handleDecline();
        } else {
          declineRef.current?.focus();
        }
      }
      if (e.key === 'Enter' && state === 'idle') {
        e.preventDefault();
        handleAccept();
      }
    },
    [handleAccept, handleDecline, state],
  );

  const label = String(agentLabel);

  return (
    <div
      ref={containerRef}
      role="alertdialog"
      aria-modal="true"
      aria-label={CEREMONY_COPY.upgrade.title(label)}
      onKeyDown={handleKeyDown}
      className="motion-reduce:transition-none fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        className={`mx-4 w-full max-w-md rounded-lg bg-[var(--flow-color-bg-surface-raised)] p-6 shadow-xl ${
          state === 'celebrating' ? 'animate-[celebrate_0.3s_ease-out]' : ''
        }`}
      >
        <CeremonyStepAcknowledge
          agentLabel={label}
          actionLabel={String(actionLabel)}
          escapeInstruction={CEREMONY_COPY.upgrade.escapeInstruction}
        />
        <div className="mt-3">
          <CeremonyStepStats
            cleanApprovals={Number(cleanApprovals)}
            totalRuns={Number(totalRuns)}
            daysAtLevel={Number(daysAtLevel)}
          />
        </div>
        {state === 'error' && (
          <p className="mt-2 text-sm text-red-400" role="alert">
            Something went wrong. Please try again.
          </p>
        )}
        <div className="mt-4">
          <CeremonyStepConfirm
            onAccept={handleAccept}
            onDecline={handleDecline}
            onRemindLater={handleRemindLater}
            declineRef={declineRef}
            loading={state === 'submitting'}
          />
        </div>
      </div>
    </div>
  );
}
