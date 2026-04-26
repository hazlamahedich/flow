export default function ClientDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--flow-color-bg-surface-secondary)]" />
        <div className="flex gap-2">
          <div className="h-10 w-20 animate-pulse rounded-md bg-[var(--flow-color-bg-surface-secondary)]" />
          <div className="h-10 w-24 animate-pulse rounded-md bg-[var(--flow-color-bg-surface-secondary)]" />
        </div>
      </div>
      <div className="h-64 w-full animate-pulse rounded-lg bg-[var(--flow-color-bg-surface-secondary)]" />
    </div>
  );
}
