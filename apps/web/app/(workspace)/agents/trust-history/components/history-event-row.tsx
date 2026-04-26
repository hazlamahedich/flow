import type { TrustEventRow } from '@flow/db';
import { AGENT_IDENTITY } from '@flow/shared';

const LEVEL_ORDER: Record<string, number> = {
  supervised: 0,
  confirm: 1,
  auto: 2,
};

interface HistoryEventRowProps {
  event: TrustEventRow;
  tabIndex?: number;
  rowRef?: (el: HTMLTableRowElement | null) => void;
  onFocus?: () => void;
}

export function HistoryEventRow({ event, tabIndex = -1, rowRef, onFocus }: HistoryEventRowProps) {
  const isUpgrade = (LEVEL_ORDER[event.toLevel] ?? 0) > (LEVEL_ORDER[event.fromLevel] ?? 0);
  const agentIdentity = AGENT_IDENTITY[event.agentId as keyof typeof AGENT_IDENTITY];
  const agentLabel = agentIdentity?.label ?? event.agentId;

  const transitionColor = isUpgrade
    ? 'text-green-700 dark:text-green-400'
    : 'text-amber-700 dark:text-amber-400';

  const borderIcon = isUpgrade ? '↑' : '↓';

  return (
    <tr
      ref={rowRef}
      role="row"
      tabIndex={tabIndex}
      onFocus={onFocus}
      className="border-b border-[var(--flow-color-border-default)] last:border-0 focus:bg-[var(--flow-color-bg-hover)] focus:outline-none"
      data-testid={`history-event-${event.id}`}
    >
      <td className="py-2 text-xs text-[var(--flow-color-text-primary)]">
        {agentLabel}
      </td>
      <td className="py-2">
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${transitionColor}`}>
          <span aria-hidden="true">{borderIcon}</span>
          <span>{event.fromLevel}</span>
          <span aria-hidden="true">→</span>
          <span>{event.toLevel}</span>
        </span>
      </td>
      <td className="py-2 text-xs text-[var(--flow-color-text-secondary)] max-w-[200px] truncate">
        {event.triggerReason}
      </td>
      <td className="py-2 text-xs text-[var(--flow-color-text-secondary)]">
        {new Date(event.createdAt).toLocaleDateString()}
      </td>
    </tr>
  );
}
