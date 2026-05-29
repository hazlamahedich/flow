import { formatDuration } from '@/lib/format-duration';

interface TimeSummaryContent {
  totalMinutes: number;
}

export function TimeSummarySection({ content }: { content: any }) {
  const total = content?.totalMinutes ?? 0;
  const narrative = content?.narrative;
  return (
    <section data-testid="section-time-summary" className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">Time Summary</h2>
      {narrative && (
        <p className="text-sm text-muted-foreground italic mb-3 bg-muted/30 p-3 rounded-md">
          {narrative}
        </p>
      )}
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
