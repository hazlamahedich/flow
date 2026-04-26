'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CHECKIN_COPY } from '../constants/trust-copy';
import type { ActionResult } from '@flow/types';

interface TrustCheckInPromptProps {
  agentId: string;
  agentLabel: string;
  workspaceId: string;
  deferredCount: number;
  isPinned: boolean;
  onAccept: () => void;
  onDefer: () => Promise<ActionResult<{ deferredCount: number; nextCheckIn: string | null; pinned: boolean }>>;
}

export function TrustCheckInPrompt({
  agentId,
  agentLabel,
  deferredCount,
  isPinned,
  onAccept,
  onDefer,
}: TrustCheckInPromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(20_000);
  const startedAtRef = useRef<number | null>(null);

  const startTimer = useCallback((ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    startedAtRef.current = Date.now();
    remainingRef.current = ms;
    timerRef.current = setTimeout(() => {
      setDismissed(true);
      if (previousFocusRef.current) previousFocusRef.current.focus();
    }, ms);
  }, []);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    startTimer(20_000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startTimer]);

  useEffect(() => {
    if (paused && timerRef.current) {
      const elapsed = Date.now() - (startedAtRef.current ?? Date.now());
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      clearTimeout(timerRef.current);
      timerRef.current = null;
    } else if (!paused && !dismissed) {
      if (remainingRef.current > 0) {
        startTimer(remainingRef.current);
      } else {
        setDismissed(true);
        if (previousFocusRef.current) previousFocusRef.current.focus();
      }
    }
  }, [paused, dismissed, startTimer]);

  if (dismissed) return null;

  const handleDefer = async () => {
    setLoading(true);
    setError(null);
    const result = await onDefer();
    setLoading(false);
    if (!result.success) {
      setError('Could not snooze. Please try again.');
      return;
    }
    setDismissed(true);
    if (previousFocusRef.current) previousFocusRef.current.focus();
  };

  const handleAccept = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onAccept();
  };

  return (
    <div
      ref={containerRef}
      role="complementary"
      aria-label={`Trust check-in for ${agentLabel}`}
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
      data-testid={`checkin-prompt-${agentId}`}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="text-sm text-[var(--flow-color-text-primary)] mb-3">
        {CHECKIN_COPY.prompt.title(agentLabel)}
      </p>

      {error && (
        <p className="text-xs text-red-600 mb-2" role="alert">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          tabIndex={0}
        >
          {CHECKIN_COPY.prompt.accept}
        </button>

        {!isPinned && deferredCount < 3 && (
          <button
            onClick={handleDefer}
            disabled={loading}
            className="rounded-md border border-[var(--flow-color-border-default)] px-3 py-1.5 text-xs font-medium text-[var(--flow-color-text-secondary)] hover:bg-[var(--flow-color-bg-hover)] focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
            tabIndex={0}
          >
            {loading ? '...' : CHECKIN_COPY.prompt.defer}
          </button>
        )}
      </div>
    </div>
  );
}
