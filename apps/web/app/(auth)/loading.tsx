export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--flow-color-bg-primary)]">
      <div className="w-full max-w-md animate-pulse">
        <div className="rounded-lg border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)] p-8">
          <div className="mx-auto mb-6 h-8 w-48 rounded bg-[var(--flow-color-bg-tertiary)]" />
          <div className="mb-4 h-10 rounded bg-[var(--flow-color-bg-tertiary)]" />
          <div className="h-10 rounded bg-[var(--flow-color-bg-tertiary)]" />
        </div>
      </div>
    </div>
  );
}
