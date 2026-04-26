'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { overlayStackAtom, type OverlayEntry } from '@/lib/atoms/overlay';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import { useTrustAnnouncer } from '@/lib/hooks/use-trust-announcer';
import { CEREMONY_COPY, UNDO_COPY, REGRESSION_ACKNOWLEDGED_COPY } from '../constants/trust-copy';
import { undoRegression, acknowledgeRegression } from '../actions/trust-actions';

const triggerElMap = new WeakMap<OverlayEntry, HTMLElement>();

export function registerRecoveryTrigger(entry: OverlayEntry, el: HTMLElement) {
  triggerElMap.set(entry, el);
}

interface TrustRecoveryProps {
  entry: OverlayEntry;
}

export function TrustRecovery({ entry }: TrustRecoveryProps) {
  const {
    agentLabel = '',
    capabilities = [],
    affectedTasksCount = 0,
    triggerReason = '',
    isAutoTriggered = false,
    matrixEntryId = '',
    transitionId = '',
    expectedVersion = 1,
    cleanApprovals = 0,
    rejectionCount = 0,
  } = entry.props as Record<string, unknown>;

  const [, dispatch] = useAtom(overlayStackAtom);
  const announce = useTrustAnnouncer();
  const ackRef = useRef<HTMLButtonElement>(null);
  const [undoState, setUndoState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const triggerEl = triggerElMap.get(entry) ?? null;
  const { containerRef, activate, deactivate } = useFocusTrap(triggerEl);

  const close = useCallback(() => {
    deactivate();
    dispatch({ type: 'pop', id: entry.id });
  }, [deactivate, dispatch, entry.id]);

  useEffect(() => {
    activate();
    announce(CEREMONY_COPY.upgrade.escapeInstruction, 'assertive');
    announce(CEREMONY_COPY.downgrade.title(String(agentLabel)), 'assertive');
  }, [activate, announce, agentLabel]);

  const handleUndo = useCallback(async () => {
    if (undoState !== 'idle') return;
    setUndoState('loading');
    try {
      const result = await undoRegression({
        transitionId: String(transitionId),
        matrixEntryId: String(matrixEntryId),
        expectedVersion: Number(expectedVersion),
      });
      if (result.success) {
        setUndoState('done');
        announce(UNDO_COPY.success, 'polite');
        setTimeout(close, 1500);
      } else {
        setUndoState('error');
      }
    } catch {
      setUndoState('error');
    }
  }, [close, announce, undoState, transitionId, matrixEntryId, expectedVersion]);

  const handleKeepAuto = useCallback(async () => {
    if (transitionId) {
      try { await acknowledgeRegression({ transitionId: String(transitionId) }); } catch {}
    }
    announce('Regression acknowledged. Agent stays in Auto mode.', 'polite');
    close();
  }, [announce, close, transitionId]);

  const handleMoveToConfirmAll = useCallback(async () => {
    if (transitionId) {
      try { await acknowledgeRegression({ transitionId: String(transitionId) }); } catch {}
    }
    announce(REGRESSION_ACKNOWLEDGED_COPY, 'polite');
    close();
  }, [announce, close, transitionId]);

  const handleAcknowledge = useCallback(async () => {
    if (transitionId) {
      try { await acknowledgeRegression({ transitionId: String(transitionId) }); } catch {}
    }
    announce(REGRESSION_ACKNOWLEDGED_COPY, 'polite');
    close();
  }, [announce, close, transitionId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (undoState === 'loading') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (document.activeElement === ackRef.current) {
          handleAcknowledge();
        } else {
          ackRef.current?.focus();
        }
      }
    },
    [handleAcknowledge, undoState],
  );

  const caps = Array.isArray(capabilities) ? capabilities : [String(capabilities)];
  const label = String(agentLabel);
  const showUndo = Boolean(isAutoTriggered) && undoState === 'idle';

  return (
    <div
      ref={containerRef}
      role="alertdialog"
      aria-modal="true"
      aria-label={CEREMONY_COPY.downgrade.title(label)}
      onKeyDown={handleKeyDown}
      className="motion-reduce:transition-none fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="mx-4 w-full max-w-lg rounded-lg bg-[var(--flow-color-bg-surface-raised)] p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-[var(--flow-color-text-primary)]">
          {CEREMONY_COPY.downgrade.title(label)}
        </h2>
        <p className="mt-2 text-sm text-[var(--flow-color-text-secondary)]">
          {CEREMONY_COPY.downgrade.summary(label, caps)}
        </p>
        <p className="mt-1 text-sm text-[var(--flow-color-text-tertiary)]">
          {CEREMONY_COPY.downgrade.reason(String(triggerReason))}
        </p>
        {(Number(cleanApprovals) > 0 || Number(rejectionCount) > 0) && (
          <p className="mt-1 text-xs text-[var(--flow-color-text-tertiary)]">
            {Number(cleanApprovals)} clean approvals, {Number(rejectionCount)} rejection{Number(rejectionCount) !== 1 ? 's' : ''}
          </p>
        )}
        {Number(affectedTasksCount) > 0 && (
          <p className="mt-1 text-xs text-[var(--flow-color-text-tertiary)]">
            {Number(affectedTasksCount)} task{Number(affectedTasksCount) !== 1 ? 's' : ''} using these capabilities paused
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          {showUndo && (
            <button
              type="button"
              onClick={handleUndo}
              className="rounded-md bg-[var(--flow-color-bg-surface-hover)] px-4 py-2 text-sm font-semibold text-[var(--flow-color-text-primary)] focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)]"
            >
              {CEREMONY_COPY.downgrade.undoLabel}
            </button>
          )}
          <button
            type="button"
            onClick={handleKeepAuto}
            disabled={undoState === 'loading'}
            className="rounded-md px-4 py-2 text-sm font-medium text-[var(--flow-color-text-secondary)] hover:text-[var(--flow-color-text-primary)] focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)] disabled:opacity-50"
          >
            {CEREMONY_COPY.downgrade.options.keepAuto}
          </button>
          <button
            type="button"
            onClick={handleMoveToConfirmAll}
            disabled={undoState === 'loading'}
            className="rounded-md px-4 py-2 text-sm font-medium text-[var(--flow-color-text-secondary)] hover:text-[var(--flow-color-text-primary)] focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)] disabled:opacity-50"
          >
            {CEREMONY_COPY.downgrade.options.moveToConfirmAll}
          </button>
          <button
            ref={ackRef}
            type="button"
            onClick={handleAcknowledge}
            disabled={undoState === 'loading'}
            className="rounded-md px-4 py-2 text-sm font-medium text-[var(--flow-color-text-tertiary)] hover:text-[var(--flow-color-text-secondary)] focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)] disabled:opacity-50"
          >
            {CEREMONY_COPY.downgrade.acknowledge}
          </button>
        </div>

        {undoState === 'loading' && (
          <span className="mt-2 block text-sm text-[var(--flow-color-text-tertiary)]">Undoing…</span>
        )}
        {undoState === 'done' && (
          <span className="mt-2 block text-sm text-[var(--flow-color-text-secondary)]">{UNDO_COPY.success}</span>
        )}
        {undoState === 'error' && (
          <span className="mt-2 block text-sm text-red-400">{UNDO_COPY.error}</span>
        )}
      </div>
    </div>
  );
}
