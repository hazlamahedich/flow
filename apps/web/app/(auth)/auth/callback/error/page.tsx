export default function AuthCallbackErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--flow-color-bg-primary)]">
      <div className="w-full max-w-md rounded-lg border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)] p-8 text-center">
        <h1 className="mb-2 text-lg font-semibold text-[var(--flow-color-text-primary)]">
          We couldn&apos;t verify your login link
        </h1>
        <p className="mb-6 text-sm text-[var(--flow-color-text-secondary)]">
          The link may have expired or something went wrong. Please request a new one.
        </p>
        <a
          href="/login"
          className="inline-block rounded-md bg-[var(--flow-color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Request a new link
        </a>
      </div>
    </div>
  );
}
