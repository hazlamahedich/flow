'use client';

import { useState } from 'react';
import type { Retainer } from '@flow/types';
import { cancelRetainerAction } from '../actions/retainer/cancel-retainer';

interface EndRetainerDialogProps {
  retainer: Retainer;
  trackedMinutes: number;
  activeScopeAlerts: number;
  onClose: () => void;
  onEnded: () => void;
}

export function EndRetainerDialog({
  retainer,
  trackedMinutes,
  activeScopeAlerts,
  onClose,
  onEnded,
}: EndRetainerDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnd() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await cancelRetainerAction({
        retainerId: retainer.id,
        reason: reason || undefined,
      });
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      onEnded();
    } catch {
      setError('Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  const trackedHours = (trackedMinutes / 60).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-[var(--flow-color-border-default)] bg-[var(--flow-bg-surface)] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[var(--flow-color-text-primary)]">End Retainer Agreement</h2>

        <div className="mt-4 space-y-2 text-sm text-[var(--flow-color-text-secondary)]">
          <p>You&apos;ve tracked <strong>{trackedHours} hours</strong> this billing period — this data is preserved.</p>
          <p>{activeScopeAlerts} active scope alert{activeScopeAlerts !== 1 ? 's' : ''} will be dismissed.</p>
          <p>Historical retainer data will be archived in the client timeline.</p>
        </div>

        <label className="mt-4 block text-sm">
          <span className="text-[var(--flow-color-text-secondary)]">Reason (optional)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={2}
            className="mt-1 block w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
          />
        </label>

        {error && <p className="mt-2 text-sm text-[var(--flow-status-error)]">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm"
          >
            Keep Active
          </button>
          <button
            onClick={handleEnd}
            disabled={submitting}
            className="rounded-md bg-[var(--flow-status-error)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Ending...' : 'End Agreement'}
          </button>
        </div>
      </div>
    </div>
  );
}
