'use client';

import { useState, useEffect } from 'react';
import { CHECKIN_COPY } from '../constants/trust-copy';
import type { AutoActionRow } from '@flow/db';
import type { ActionResult } from '@flow/types';

interface TrustCheckInReviewProps {
  agentId: string;
  agentLabel: string;
  workspaceId: string;
  actions: AutoActionRow[];
  onAcknowledge: () => Promise<ActionResult<{ reviewedAt: string }>>;
  onAdjust: (agentId: string) => void;
}

export function TrustCheckInReview({
  agentId,
  agentLabel,
  actions,
  onAcknowledge,
  onAdjust,
}: TrustCheckInReviewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAcknowledge = async () => {
    setLoading(true);
    setError(null);
    const result = await onAcknowledge();
    setLoading(false);
    if (!result.success) {
      setError('Could not confirm. Please try again.');
    }
  };

  const handleAdjust = () => {
    onAdjust(agentId);
  };

  return (
    <div
      className="rounded-lg border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)] p-4"
      data-testid={`checkin-review-${agentId}`}
    >
      <h3 className="text-sm font-medium text-[var(--flow-color-text-primary)] mb-3">
        {CHECKIN_COPY.review.title(agentLabel)}
      </h3>

      {actions.length === 0 ? (
        <div className="mb-3">
          <p className="text-sm text-[var(--flow-color-text-secondary)]">
            {CHECKIN_COPY.review.emptyTitle}
          </p>
        </div>
      ) : (
        <ul className="space-y-2 mb-3">
          {actions.map((action) => (
            <li
              key={action.id}
              className="flex justify-between text-xs text-[var(--flow-color-text-secondary)] py-1 border-b border-[var(--flow-color-border-default)] last:border-0"
            >
              <span>{action.actionType}</span>
              <span>{new Date(action.createdAt).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-xs text-red-600 mb-2" role="alert">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleAcknowledge}
          disabled={loading}
          className="rounded-md bg-[var(--flow-emotion-trust-auto)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
        >
          {loading ? '...' : CHECKIN_COPY.review.accept}
        </button>
        <button
          onClick={handleAdjust}
          className="rounded-md border border-[var(--flow-color-border-default)] px-3 py-1.5 text-xs font-medium text-[var(--flow-color-text-secondary)] hover:bg-[var(--flow-color-bg-hover)] focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {CHECKIN_COPY.review.adjust}
        </button>
      </div>
    </div>
  );
}
