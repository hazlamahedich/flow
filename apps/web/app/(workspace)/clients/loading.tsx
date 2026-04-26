export default function ClientsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded bg-[var(--flow-color-bg-surface-secondary)]" />
        <div className="h-10 w-28 animate-pulse rounded-md bg-[var(--flow-color-bg-surface-secondary)]" />
      </div>
      <div className="h-10 w-full animate-pulse rounded-md bg-[var(--flow-color-bg-surface-secondary)]" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 w-full animate-pulse rounded bg-[var(--flow-color-bg-surface-secondary)]"
          />
        ))}
      </div>
    </div>
  );
}
