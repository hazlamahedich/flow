'use client';

function relativeTime(date: Date): string {
  const ms = Date.now() - date.getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

interface TrustTransition {
  id: string;
  from_level: string;
  to_level: string;
  trigger_type: string;
  trigger_reason: string;
  created_at: string;
}

interface TrustHistoryProps {
  transitions: TrustTransition[];
}

export function TrustHistory({ transitions }: TrustHistoryProps) {
  if (transitions.length === 0) {
    return (
      <div className="py-3 text-center text-xs text-[var(--flow-text-muted)]">
        No trust transitions recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-[var(--flow-text-secondary)]">Recent Transitions</span>
      <ul className="space-y-1.5" role="list">
        {transitions.slice(0, 10).map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between rounded-[var(--flow-radius-sm)] px-2 py-1.5 text-xs hover:bg-[var(--flow-bg-surface-raised)]"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--flow-text-muted)]">{t.from_level}</span>
              <span className="text-[var(--flow-text-muted)]">→</span>
              <span className="font-medium text-[var(--flow-text-primary)]">{t.to_level}</span>
              <span className="text-[var(--flow-text-muted)]">·</span>
              <span className="text-[var(--flow-text-secondary)]">{t.trigger_type.replace(/_/g, ' ')}</span>
            </div>
            <span className="text-[var(--flow-text-muted)]" title={t.created_at}>
              {relativeTime(new Date(t.created_at))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
