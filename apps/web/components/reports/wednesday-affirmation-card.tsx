'use client';

import { useState } from 'react';
import type { WednesdayAffirmationData } from '@/lib/actions/reports/get-wednesday-affirmation';

interface WednesdayAffirmationCardProps {
  affirmation: WednesdayAffirmationData;
  onDismiss: (id: string) => Promise<void>;
}

export function WednesdayAffirmationCard({
  affirmation,
  onDismiss,
}: WednesdayAffirmationCardProps) {
  const [dismissing, setDismissing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const milestone = affirmation.milestone as {
    agent_type?: string;
    trust_level?: string;
  };

  async function handleDismiss() {
    setDismissing(true);
    try {
      await onDismiss(affirmation.id);
      setDismissed(true);
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div className="wednesday-affirmation rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-6 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-purple-600 uppercase tracking-wider">
          Wednesday Affirmation
        </span>
        {milestone?.trust_level && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
            {milestone.trust_level}
          </span>
        )}
      </div>
      <p className="mb-4 text-gray-800">{affirmation.story}</p>
      <button
        type="button"
        onClick={handleDismiss}
        disabled={dismissing}
        className="text-sm text-gray-500 underline hover:text-gray-700 disabled:opacity-50"
      >
        {dismissing ? 'Dismissing...' : 'Dismiss'}
      </button>
    </div>
  );
}
