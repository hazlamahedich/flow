'use client';

export default function AuthError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--flow-color-bg-primary)]">
      <div className="w-full max-w-md rounded-lg border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)] p-8 text-center">
        <h2 className="mb-2 text-lg font-semibold text-[var(--flow-color-text-primary)]">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-[var(--flow-color-text-tertiary)]">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-[var(--flow-color-accent-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
