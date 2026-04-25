'use client';

import type { ApprovalQueueItem } from '@flow/types';
import { ProposalCard } from './proposal-card';
import { InlineEditForm } from './inline-edit-form';

interface QueueItemRowProps {
  item: ApprovalQueueItem;
  isEditing: boolean;
  isTimedOut: boolean;
  isExpanded: boolean;
  isFocused: boolean;
  isStale: boolean;
  isSelected: boolean;
  errorMsg: string | undefined;
  onSetFocused: (id: string | null) => void;
  onToggleExpand: (id: string | null) => void;
  onSetEditing: (id: string | null) => void;
  onSetMode: (mode: 'navigate' | 'edit' | 'batch') => void;
  onRemoveItems: (ids: string[]) => void;
  onAnnounce: (msg: string) => void;
}

export function QueueItemRow({
  item,
  isEditing,
  isTimedOut,
  isExpanded,
  isFocused,
  isStale,
  isSelected,
  errorMsg,
  onSetFocused,
  onToggleExpand,
  onSetEditing,
  onSetMode,
  onRemoveItems,
  onAnnounce,
}: QueueItemRowProps) {
  const runId = item.run.id;
  const itemTitle = item.proposalType === 'agent_proposal' ? item.proposal.title : `Trust gate: ${item.block.reason}`;

  return (
    <div id={`proposal-${runId}`}>
      <ProposalCard
        item={item}
        isFocused={isFocused}
        isExpanded={isExpanded}
        isTimedOut={isTimedOut}
        trustStale={isStale}
        itemTitle={itemTitle}
        onFocus={() => onSetFocused(runId)}
        onToggleExpand={() => onToggleExpand(isExpanded ? null : runId)}
      />

      {isEditing && item.proposalType === 'agent_proposal' && (
        <InlineEditForm
          proposal={item.proposal}
          reasoning={item.proposal.reasoning}
          onSave={async (changes) => {
            const { updateProposal } = await import('../actions/update-proposal');
            const result = await updateProposal({ runId, ...changes });
            if (result.success) {
              onSetEditing(null);
              onSetMode('navigate');
              return { success: true };
            }
            return { success: false, error: result.error.message };
          }}
          onCancel={() => {
            onSetEditing(null);
            onSetMode('navigate');
          }}
          onEscape={() => {
            onSetEditing(null);
            onSetMode('navigate');
          }}
        />
      )}

      {isTimedOut && (
        <div className="mt-2 flex items-center gap-2 pl-11">
          <button
            onClick={() => {
              void (async () => {
                const { resumeRun } = await import('../actions/resume-run');
                const result = await resumeRun({ runId });
                if (result.success) {
                  onRemoveItems([runId]);
                  onAnnounce('Resumed execution');
                }
              })();
            }}
            className="rounded-[var(--flow-radius-md)] bg-[var(--flow-accent-primary)] px-3 py-1 text-xs font-medium text-[var(--flow-accent-primary-text)]"
          >
            Resume
          </button>
          <button
            onClick={() => {
              void (async () => {
                const { cancelRun } = await import('../actions/cancel-run');
                const result = await cancelRun({ runId });
                if (result.success) {
                  onRemoveItems([runId]);
                  onAnnounce('Execution cancelled');
                }
              })();
            }}
            className="rounded-[var(--flow-radius-md)] border border-[var(--flow-border-default)] px-3 py-1 text-xs font-medium text-[var(--flow-text-secondary)]"
          >
            Cancel
          </button>
        </div>
      )}

      {errorMsg && (
        <p className="mt-1 pl-11 text-xs text-[var(--flow-status-error)]" role="alert">
          {errorMsg}
        </p>
      )}

      {isSelected && (
        <div className="mt-1 pl-11 text-xs text-[var(--flow-accent-primary)]">
          Selected
        </div>
      )}
    </div>
  );
}
