'use client';

export default function ClientsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <h2 className="text-lg font-semibold text-[var(--flow-color-text-primary)]">
        Failed to load clients
      </h2>
      <p className="mt-2 text-sm text-[var(--flow-color-text-secondary)]">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-[var(--flow-color-bg-brand)] px-4 py-2 text-sm font-medium text-white"
      >
        Try again
      </button>
    </div>
  );
}
