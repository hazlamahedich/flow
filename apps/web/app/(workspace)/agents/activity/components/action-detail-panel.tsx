'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ActionHistoryRow } from '@flow/db';
import { FeedbackWidget } from './feedback-widget';
import { ErrorDisplay } from './error-display';
import { CorrectionButton } from './correction-button';

interface ActionDetailPanelProps {
  entry: ActionHistoryRow;
  workspaceId: string;
  onClose: () => void;
}

export function ActionDetailPanel({ entry, workspaceId, onClose }: ActionDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    onClose();
    if (triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [onClose]);

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT') return;
        handleClose();
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  const hasError = entry.error && (entry.status === 'failed' || entry.status === 'timed_out');
  const isCompleted = entry.status === 'completed';
  const canCorrect = isCompleted && entry.error;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={handleClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Action detail: ${entry.actionType}`}
        className="fixed right-0 top-0 h-full w-[360px] max-w-full bg-[var(--flow-color-surface)] border-l border-[var(--flow-color-border)] z-50 overflow-y-auto shadow-lg
          max-md:inset-0 max-md:w-full max-md:h-full"
      >
        <div className="sticky top-0 bg-[var(--flow-color-surface)] border-b border-[var(--flow-color-border)] p-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--flow-color-text-primary)]">{entry.actionType}</h2>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="text-[var(--flow-color-text-secondary)] hover:text-[var(--flow-color-text-primary)] p-1"
            aria-label="Close detail"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <h3 className="text-xs font-medium text-[var(--flow-color-text-secondary)] mb-1">Input</h3>
            <pre className="text-xs bg-[var(--flow-color-surface-elevated)] p-2 rounded overflow-x-auto">
              {JSON.stringify(entry.input, null, 2)}
            </pre>
          </div>

          {entry.output && (
            <div>
              <h3 className="text-xs font-medium text-[var(--flow-color-text-secondary)] mb-1">Output</h3>
              <pre className="text-xs bg-[var(--flow-color-surface-elevated)] p-2 rounded overflow-x-auto">
                {JSON.stringify(entry.output, null, 2)}
              </pre>
            </div>
          )}

          {hasError && <ErrorDisplay error={entry.error} />}

          <div className="text-xs text-[var(--flow-color-text-secondary)] space-y-1">
            <div>Created: {new Date(entry.createdAt).toLocaleString()}</div>
            {entry.completedAt && <div>Completed: {new Date(entry.completedAt).toLocaleString()}</div>}
            {entry.trustTierAtExecution && <div>Trust level: {entry.trustTierAtExecution}</div>}
          </div>

          {isCompleted && (
            <FeedbackWidget runId={entry.id} existingFeedback={entry.feedback} />
          )}

          {canCorrect && (
            <CorrectionButton entry={entry} />
          )}
        </div>
      </div>
    </>
  );
}
