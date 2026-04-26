'use client';

import { CHECKIN_COPY } from '../constants/trust-copy';

export default function TrustHistoryError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <p className="text-sm text-[var(--flow-color-text-secondary)]">
        {CHECKIN_COPY.history.error}
      </p>
      <button
        onClick={reset}
        className="rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-xs font-medium text-[var(--flow-color-text-primary)] hover:bg-[var(--flow-color-bg-hover)]"
      >
        Try again
      </button>
    </div>
  );
}
