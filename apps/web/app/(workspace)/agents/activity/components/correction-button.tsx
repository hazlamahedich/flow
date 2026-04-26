'use client';

import { useState } from 'react';
import { issueCorrection } from '../../actions/correction-actions';
import { CORRECTION_LABELS, TOAST_MESSAGES } from '../../constants/activity-copy';
import type { ActionHistoryRow } from '@flow/db';

interface CorrectionButtonProps {
  entry: ActionHistoryRow;
}

export function CorrectionButton({ entry }: CorrectionButtonProps) {
  const [showForm, setShowForm] = useState(false);
  const [output, setOutput] = useState(JSON.stringify(entry.output ?? {}, null, 2));
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (entry.correctionIssued || entry.correctionDepth >= 5) return null;

  const handleSubmit = async () => {
    setLoading(true);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(output);
    } catch {
      setToast('Invalid JSON format — please fix and try again');
      setLoading(false);
      setTimeout(() => setToast(null), 3000);
      return;
    }
    try {      const result = await issueCorrection({ originalRunId: entry.id, correctedOutput: parsed });
      if (result.success) {
        setToast(TOAST_MESSAGES.correctionSent);
        setShowForm(false);
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast(TOAST_MESSAGES.correctionFailed);
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      setToast(TOAST_MESSAGES.correctionFailed);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-[var(--flow-color-border)] pt-3 space-y-2">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="text-xs px-3 py-1.5 rounded-md bg-[var(--flow-color-primary)] text-white hover:opacity-90"
        >
          {CORRECTION_LABELS.button}
        </button>
      ) : (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-[var(--flow-color-text-primary)]">{CORRECTION_LABELS.title}</h4>
          <textarea
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            rows={6}
            className="w-full text-xs rounded-md border border-[var(--flow-color-border)] bg-[var(--flow-color-surface)] p-2 font-mono resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-md bg-[var(--flow-color-primary)] text-white hover:opacity-90 disabled:opacity-50"
            >
              {CORRECTION_LABELS.submit}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs px-3 py-1.5 rounded-md border border-[var(--flow-color-border)] hover:bg-[var(--flow-color-surface-elevated)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div className="text-xs px-3 py-2 rounded-md bg-blue-50 text-blue-700" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
