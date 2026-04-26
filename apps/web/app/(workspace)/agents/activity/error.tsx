'use client';

export default function ActivityError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <p className="text-[var(--flow-color-text-secondary)] text-center">
        We couldn&apos;t load your timeline. Your actions are safe &mdash; we&apos;ll try again.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-md bg-[var(--flow-color-primary)] text-white text-sm hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
