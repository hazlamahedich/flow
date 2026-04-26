export default function ActivityLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 w-48 bg-[var(--flow-color-surface-elevated)] rounded" />
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-32 bg-[var(--flow-color-surface-elevated)] rounded-md" />
        ))}
      </div>
      <div className="h-6 w-72 bg-[var(--flow-color-surface-elevated)] rounded" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="h-8 w-8 bg-[var(--flow-color-surface-elevated)] rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-[var(--flow-color-surface-elevated)] rounded" />
            <div className="h-3 w-1/2 bg-[var(--flow-color-surface-elevated)] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
