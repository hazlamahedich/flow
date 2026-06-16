/**
 * Value receipt component — "what these hours bought" summary.
 *
 * Story 9.2 — AC7 (UX-DR37). Presentational only.
 */
interface ValueReceiptProps {
  taskCount: number;
  meetingCount: number;
}

export function ValueReceipt({ taskCount, meetingCount }: ValueReceiptProps) {
  const safeTaskCount = Math.max(0, taskCount);
  const safeMeetingCount = Math.max(0, meetingCount);

  return (
    <div className="p-4 rounded-lg border border-[var(--flow-border-default)] bg-[var(--flow-bg-subtle)]">
      <h2 className="text-sm font-medium text-[var(--flow-text-muted)] mb-2">What this covers</h2>
      <div className="flex gap-4">
        <div>
          <span className="text-2xl font-semibold text-[var(--flow-text-primary)]">{safeTaskCount}</span>
          <span className="ml-1 text-sm text-[var(--flow-text-secondary)]">{safeTaskCount === 1 ? 'task' : 'tasks'}</span>
        </div>
        <div>
          <span className="text-2xl font-semibold text-[var(--flow-text-primary)]">{safeMeetingCount}</span>
          <span className="ml-1 text-sm text-[var(--flow-text-secondary)]">{safeMeetingCount === 1 ? 'meeting' : 'meetings'}</span>
        </div>
      </div>
    </div>
  );
}
