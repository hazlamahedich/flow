/**
 * Next-week preview component — TV-cliffhanger pattern (UX-DR39).
 *
 * Shows upcoming calendar events for the client's workspace in the next 7 days.
 * Presentational only — data is fetched server-side and passed as props.
 *
 * Story 9.2 — AC7.
 */
interface NextWeekPreviewProps {
  events: Array<{
    title: string;
    startAt: string;
  }>;
}

export function NextWeekPreview({ events }: NextWeekPreviewProps) {
  if (events.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-[var(--flow-border-default)]">
        <h2 className="text-sm font-medium text-[var(--flow-text-muted)] mb-1">Coming up</h2>
        <p className="text-sm text-[var(--flow-text-secondary)]">No upcoming events this week.</p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-[var(--flow-border-default)]">
      <h2 className="text-sm font-medium text-[var(--flow-text-muted)] mb-2">Coming up</h2>
      <ul className="space-y-1">
        {events.map((ev) => {
          const date = parseEventDate(ev.startAt);
          return (
            <li key={`${ev.title}-${ev.startAt}`} className="flex justify-between text-sm">
              <span className="text-[var(--flow-text-secondary)]">{ev.title}</span>
              <span className="text-[var(--flow-text-muted)]">{date}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function parseEventDate(startAt: string): string {
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) return 'Date TBD';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
