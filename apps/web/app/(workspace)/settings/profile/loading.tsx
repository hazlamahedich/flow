export default function ProfileLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-32 animate-pulse rounded bg-[var(--flow-color-bg-surface-raised)]" />
      <div className="space-y-4">
        <div className="h-40 w-40 animate-pulse rounded-full bg-[var(--flow-color-bg-surface-raised)]" />
        <div className="h-10 w-full animate-pulse rounded bg-[var(--flow-color-bg-surface-raised)]" />
        <div className="h-10 w-full animate-pulse rounded bg-[var(--flow-color-bg-surface-raised)]" />
      </div>
    </div>
  );
}
