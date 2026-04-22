export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[var(--flow-layout-main-content)] px-6 py-8">
      <div className="animate-pulse">
        <div className="h-8 w-64 rounded-[var(--flow-radius-sm)] bg-[var(--flow-color-bg-surface-raised)]" />
        <div className="mt-2 h-4 w-48 rounded-[var(--flow-radius-sm)] bg-[var(--flow-color-bg-surface-raised)]" />

        <div className="mt-8 space-y-6">
          <div className="h-40 rounded-[var(--flow-radius-lg)] bg-[var(--flow-color-bg-surface-raised)]" />
          <div className="h-40 rounded-[var(--flow-radius-lg)] bg-[var(--flow-color-bg-surface-raised)]" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="h-40 rounded-[var(--flow-radius-lg)] bg-[var(--flow-color-bg-surface-raised)]" />
            <div className="h-40 rounded-[var(--flow-radius-lg)] bg-[var(--flow-color-bg-surface-raised)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
