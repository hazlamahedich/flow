/**
 * Message-VA card (UX-DR40).
 *
 * Shows the workspace's VA display name and a hardcoded MVP response-time
 * estimate. TODO: source VA name + response time from workspace settings.
 *
 * Story 9.2 — AC7.
 */
interface MessageVaCardProps {
  vaDisplayName?: string;
  responseTime?: string;
}

export function MessageVaCard({
  vaDisplayName,
  responseTime,
}: MessageVaCardProps) {
  const vaName = vaDisplayName ?? 'your assistant';
  const sla = responseTime ?? '4 business hours';

  return (
    <div className="p-4 rounded-lg border border-[var(--flow-border-default)]">
      <h2 className="text-sm font-medium text-[var(--flow-text-muted)] mb-1">
        Message {vaName}
      </h2>
      <p className="text-sm text-[var(--flow-text-secondary)]">
        Typically responds within {sla}.
      </p>
      {/* TODO(9-2): Wire to a message-VA action once messaging is implemented */}
    </div>
  );
}
