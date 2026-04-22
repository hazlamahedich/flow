'use client';

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold text-[var(--flow-color-text-primary)]">
        Something went wrong
      </h2>
      <p className="text-sm text-[var(--flow-color-text-secondary)]">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-[var(--flow-radius-md)] bg-[var(--flow-color-bg-tertiary)] px-4 py-2 text-sm text-[var(--flow-color-text-primary)] hover:bg-[var(--flow-state-overlay-hover)]"
      >
        Try again
      </button>
    </div>
  );
}
