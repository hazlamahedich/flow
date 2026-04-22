export default function WorkspaceLoading() {
  return (
    <div className="flex h-screen bg-[var(--flow-color-bg-primary)]">
      <div
        className="hidden w-[var(--flow-layout-sidebar-expanded)] shrink-0 animate-pulse border-r border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)] lg:block"
        aria-hidden="true"
      >
        <div className="p-4">
          <div className="h-4 w-24 rounded bg-[var(--flow-color-bg-tertiary)]" />
        </div>
        <div className="space-y-2 px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-full rounded bg-[var(--flow-color-bg-tertiary)]"
            />
          ))}
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="space-y-4">
          <div className="h-8 w-48 rounded bg-[var(--flow-color-bg-tertiary)] animate-pulse" />
          <div className="h-32 w-full rounded bg-[var(--flow-color-bg-tertiary)] animate-pulse" />
          <div className="h-24 w-3/4 rounded bg-[var(--flow-color-bg-tertiary)] animate-pulse" />
        </div>
      </div>
    </div>
  );
}
