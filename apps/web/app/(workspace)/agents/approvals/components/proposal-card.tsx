'use client';

import type { ApprovalQueueItem, AgentId } from '@flow/types';

const AGENT_IDENTITY: Record<string, { cssVar: string; icon: string; label: string }> = {
  inbox: { cssVar: 'var(--flow-agent-inbox)', icon: 'I', label: 'Inbox' },
  calendar: { cssVar: 'var(--flow-agent-calendar)', icon: 'C', label: 'Calendar' },
  'ar-collection': { cssVar: 'var(--flow-agent-ar)', icon: '$', label: 'AR Collection' },
  'weekly-report': { cssVar: 'var(--flow-agent-report)', icon: 'R', label: 'Reports' },
  'client-health': { cssVar: 'var(--flow-agent-health)', icon: 'H', label: 'Health' },
  'time-integrity': { cssVar: 'var(--flow-agent-time)', icon: 'T', label: 'Time' },
};

interface ProposalCardProps {
  item: ApprovalQueueItem;
  isFocused: boolean;
  isExpanded: boolean;
  isTimedOut: boolean;
  trustStale: boolean;
  itemTitle: string;
  onFocus: () => void;
  onToggleExpand: () => void;
}

export function ProposalCard({
  item,
  isFocused,
  isExpanded,
  isTimedOut,
  trustStale,
  itemTitle,
  onFocus,
  onToggleExpand,
}: ProposalCardProps) {
  const identity = AGENT_IDENTITY[item.run.agentId] ?? { cssVar: 'var(--flow-text-secondary)', icon: '?', label: item.run.agentId };
  const typeLabel = item.proposalType === 'agent_proposal' ? 'Agent Proposal' : 'Trust Gate';

  return (
    <div
      role="listitem"
      tabIndex={isFocused ? 0 : -1}
      aria-selected={isFocused}
      aria-expanded={isExpanded}
      aria-label={`${identity.label} ${typeLabel}: ${itemTitle}`}
      onFocus={onFocus}
      className={[
        'rounded-[var(--flow-radius-lg)] border bg-[var(--flow-bg-surface)] p-4 motion-reduce:transition-none transition-colors',
        isFocused
          ? 'border-[var(--flow-accent-primary)] ring-2 ring-[var(--flow-accent-primary)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-accent-primary)]'
          : 'border-[var(--flow-border-default)]',
        isTimedOut ? 'opacity-70 border-[var(--flow-status-warning)]' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: `${identity.cssVar}20`, color: identity.cssVar }}
          aria-hidden="true"
        >
          {identity.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--flow-text-primary)]">
              {identity.label}
            </span>
            <span className="inline-flex items-center rounded-[var(--flow-radius-full)] border border-[var(--flow-border-default)] px-2 py-0.5 text-[10px] font-medium text-[var(--flow-text-secondary)]">
              {typeLabel}
            </span>
            {trustStale && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--flow-status-warning)]" aria-label="Trust changed since proposal">
                {'\u26A0'} Trust changed
              </span>
            )}
            {isTimedOut && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--flow-status-warning)]">
                {'\u23F8'} Execution paused
              </span>
            )}
          </div>

          {item.proposalType === 'agent_proposal' ? (
            <AgentProposalContent item={item} isExpanded={isExpanded} />
          ) : (
            <TrustBlockContent item={item} isExpanded={isExpanded} />
          )}
        </div>

        <button
          onClick={onToggleExpand}
          className="shrink-0 text-xs text-[var(--flow-text-tertiary)] hover:text-[var(--flow-text-secondary)]"
          aria-label={isExpanded ? 'Collapse reasoning' : 'Expand reasoning'}
        >
          {isExpanded ? '\u25B2' : '\u25BC'}
        </button>
      </div>

      {!isExpanded && (
        <div className="mt-2 flex items-center gap-3 pl-11 text-[10px] text-[var(--flow-text-tertiary)]" aria-hidden="true">
          <span>[A]pprove</span>
          <span>[R]eject</span>
          <span>[E]dit</span>
          <span>[Tab]Why?</span>
        </div>
      )}
    </div>
  );
}

function AgentProposalContent({
  item,
  isExpanded,
}: {
  item: Extract<ApprovalQueueItem, { proposalType: 'agent_proposal' }>;
  isExpanded: boolean;
}) {
  const { proposal } = item;
  const riskColors: Record<string, string> = {
    low: 'text-[var(--flow-status-success)]',
    medium: 'text-[var(--flow-status-warning)]',
    high: 'text-[var(--flow-status-error)]',
  };

  return (
    <div className="mt-1">
      <p className="text-sm text-[var(--flow-text-secondary)] truncate">
        {proposal.title}
      </p>
      <div className="mt-1 flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-16 rounded-full bg-[var(--flow-bg-surface-raised)]">
            <div
              className="h-full rounded-full bg-[var(--flow-accent-primary)]"
              style={{ width: `${Math.round(proposal.confidence * 100)}%` }}
            />
          </div>
          <span className="text-[var(--flow-text-tertiary)]">{Math.round(proposal.confidence * 100)}%</span>
        </div>
        <span className={riskColors[proposal.riskLevel] ?? 'text-[var(--flow-text-tertiary)]'}>
          {proposal.riskLevel} risk
        </span>
      </div>
      {isExpanded && (
        <div className="mt-3 rounded-[var(--flow-radius-md)] bg-[var(--flow-bg-surface-raised)] p-3 text-sm text-[var(--flow-text-secondary)]">
          <p className="font-medium text-[var(--flow-text-primary)] mb-1">Reasoning</p>
          <p>{proposal.reasoning}</p>
        </div>
      )}
    </div>
  );
}

function TrustBlockContent({
  item,
  isExpanded,
}: {
  item: Extract<ApprovalQueueItem, { proposalType: 'trust_blocked' }>;
  isExpanded: boolean;
}) {
  const { block } = item;

  return (
    <div className="mt-1">
      <p className="text-sm text-[var(--flow-text-secondary)]">
        Blocked: {block.reason}
      </p>
      {isExpanded && (
        <div className="mt-3 rounded-[var(--flow-radius-md)] bg-[var(--flow-bg-surface-raised)] p-3 text-sm">
          <p className="font-medium text-[var(--flow-text-primary)] mb-1">Trust Decision</p>
          <p className="text-[var(--flow-text-secondary)]">{block.decision}</p>
          <p className="mt-2 text-xs text-[var(--flow-text-tertiary)]">
            Approve to allow execution.
          </p>
        </div>
      )}
    </div>
  );
}
