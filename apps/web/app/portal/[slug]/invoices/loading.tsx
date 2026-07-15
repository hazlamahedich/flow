/**
 * Loading skeleton for the portal invoice list.
 *
 * Story 9.2 — AC2. Matches content shape (list of invoice cards).
 */
export default function PortalInvoicesLoading() {
  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-4">
      <div className="h-8 w-32 rounded bg-[var(--flow-skeleton)] animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-lg border border-[var(--flow-border-default)] space-y-2"
          >
            <div className="flex justify-between">
              <div className="h-5 w-28 rounded bg-[var(--flow-skeleton)] animate-pulse" />
              <div className="h-5 w-20 rounded bg-[var(--flow-skeleton)] animate-pulse" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-24 rounded bg-[var(--flow-skeleton)] animate-pulse" />
              <div className="h-4 w-20 rounded bg-[var(--flow-skeleton)] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
