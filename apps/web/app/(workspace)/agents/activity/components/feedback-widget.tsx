'use client';

import { useState, useRef, useCallback } from 'react';
import { submitFeedback } from '../../actions/feedback-actions';
import { FEEDBACK_PROMPTS } from '../../constants/activity-copy';
import type { FeedbackRow } from '@flow/db';

interface FeedbackWidgetProps {
  runId: string;
  existingFeedback: FeedbackRow | null;
}

export function FeedbackWidget({ runId, existingFeedback }: FeedbackWidgetProps) {
  const [sentiment, setSentiment] = useState<'positive' | 'negative' | null>(existingFeedback?.sentiment ?? null);
  const [note, setNote] = useState(existingFeedback?.note ?? '');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const liveRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback((newSentiment: 'positive' | 'negative') => {
    setSentiment(newSentiment);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!sentiment) return;
    setLoading(true);
    const result = await submitFeedback({ runId, sentiment, note: note || undefined });
    setLoading(false);
    if (result.success) {
      setConfirmed(true);
      if (liveRef.current) liveRef.current.textContent = FEEDBACK_PROMPTS.recorded;
      setTimeout(() => setConfirmed(false), 2000);
    }
  }, [sentiment, note, runId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSentiment('positive');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSentiment('negative');
    }
  }, []);

  return (
    <div className="border-t border-[var(--flow-color-border)] pt-3 space-y-2">
      <div role="radiogroup" aria-label="Rate this action" className="flex items-center gap-2" onKeyDown={handleKeyDown}>
        <button
          role="radio"
          aria-checked={sentiment === 'positive'}
          aria-label={FEEDBACK_PROMPTS.positive}
          onClick={() => handleSelect('positive')}
          className={`p-2 rounded-md border text-lg transition-opacity ${sentiment === 'positive' ? 'border-green-500 bg-green-50 opacity-100' : 'border-[var(--flow-color-border)] opacity-60 hover:opacity-100'} ${confirmed && sentiment === 'positive' ? 'animate-pulse' : ''}`}
        >
          👍
        </button>
        <button
          role="radio"
          aria-checked={sentiment === 'negative'}
          aria-label={FEEDBACK_PROMPTS.negative}
          onClick={() => handleSelect('negative')}
          className={`p-2 rounded-md border text-lg transition-opacity ${sentiment === 'negative' ? 'border-red-400 bg-red-50 opacity-100' : 'border-[var(--flow-color-border)] opacity-60 hover:opacity-100'} ${confirmed && sentiment === 'negative' ? 'animate-pulse' : ''}`}
        >
          👎
        </button>
        {confirmed && <span className="text-xs text-green-600">{FEEDBACK_PROMPTS.recorded}</span>}
      </div>

      {sentiment && (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={FEEDBACK_PROMPTS.notePlaceholder}
            maxLength={500}
            rows={2}
            className="w-full text-xs rounded-md border border-[var(--flow-color-border)] bg-[var(--flow-color-surface)] p-2 resize-none"
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="text-xs px-3 py-1 rounded-md bg-[var(--flow-color-primary)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save feedback'}
          </button>
        </div>
      )}
      <div ref={liveRef} aria-live="polite" className="sr-only" />
    </div>
  );
}
