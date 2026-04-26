export default function TrustHistoryLoading() {
  return (
    <div className="space-y-6 motion-safe:animate-pulse">
      <div className="h-8 w-48 rounded bg-[var(--flow-color-bg-muted)]" />

      <div className="flex gap-3">
        <div className="h-9 w-32 rounded bg-[var(--flow-color-bg-muted)]" />
        <div className="h-9 w-32 rounded bg-[var(--flow-color-bg-muted)]" />
        <div className="h-9 w-32 rounded bg-[var(--flow-color-bg-muted)]" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-12 w-full rounded bg-[var(--flow-color-bg-muted)]"
          />
        ))}
      </div>
    </div>
  );
}
