'use client';

export default function ProfileError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
        Profile
      </h1>
      <div className="rounded-lg border border-[var(--flow-color-border-default)] p-6 text-center">
        <p className="text-sm text-[var(--flow-color-text-secondary)]">
          Something went wrong loading your profile.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex items-center justify-center rounded-[var(--flow-radius-md)] bg-[var(--flow-accent-primary)] px-4 py-2 text-sm font-medium text-[var(--flow-accent-primary-text)] hover:brightness-[var(--flow-state-hover-brightness)]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
