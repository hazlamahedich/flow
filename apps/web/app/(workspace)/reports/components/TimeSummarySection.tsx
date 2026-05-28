import { formatDuration } from '@/lib/format-duration';

interface TimeSummaryContent {
  totalMinutes: number;
}

export function TimeSummarySection({ content }: { content: TimeSummaryContent }) {
  const total = content?.totalMinutes ?? 0;
  return (
    <section data-testid="section-time-summary" className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">Time Summary</h2>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No time logged this period</p>
      ) : (
        <div className="rounded-md border p-4">
          <p className="text-2xl font-bold">{formatDuration(total)}</p>
        </div>
      )}
    </section>
  );
}
