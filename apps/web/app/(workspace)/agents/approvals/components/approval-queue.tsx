'use client';

import { useState, useRef, useCallback } from 'react';
import type { ApprovalQueueItem, AgentRunStatus } from '@flow/types';
import { QueueItemRow } from './queue-item-row';
import { useTriageKeyboard } from './use-triage-keyboard';
import { useOptimisticAction } from './use-optimistic-action';
import { useApprovalRealtime } from './use-approval-realtime';
import { AGENT_LABELS } from '../constants';

interface ApprovalQueueProps {
  initialItems: ApprovalQueueItem[];
  agentBreakdown: Record<string, number>;
  totalCount: number;
  trustStaleIds?: Set<string>;
  workspaceId: string;
}

export function ApprovalQueue({ initialItems, agentBreakdown, totalCount, trustStaleIds, workspaceId }: ApprovalQueueProps) {
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [announcement, setAnnouncement] = useState('');
  const [modeAnnouncement, setModeAnnouncement] = useState('');
  const queueRef = useRef<HTMLDivElement>(null);

  const itemIds = items.map((i) => i.run.id);
  const staleIds = trustStaleIds ?? new Set<string>();
  const timedOutIds = new Set(
    items.filter((i) => i.run.status === 'timed_out').map((i) => i.run.id),
  );

  const optimisticItems = items.map((i) => ({
    runId: i.run.id,
    status: i.run.status,
  }));

  const announce = useCallback((msg: string) => {
    setAnnouncement('');
    requestAnimationFrame(() => setAnnouncement(msg));
  }, []);

  const handleError = useCallback((runId: string, message: string) => {
    setErrors((prev) => new Map(prev).set(runId, message));
  }, []);

  const removeItems = useCallback((ids: string[]) => {
    setItems((prev) => prev.filter((i) => !ids.includes(i.run.id)));
  }, []);

  const { execute: executeOptimistic } = useOptimisticAction({
    items: optimisticItems,
    actionFn: async () => ({ success: true }),
    onError: handleError,
  });

  const onNewItem = useCallback((item: ApprovalQueueItem) => {
    setItems((prev) => [...prev, item]);
  }, []);

  useApprovalRealtime({ workspaceId, onNewItem });

  const handleAction = useCallback(async (
    runId: string,
    actionFn: (input: unknown) => Promise<{ success: boolean; data?: { newStatus?: AgentRunStatus }; error?: { message: string } }>,
    input: unknown,
    actionLabel: string,
    itemLabel: string,
  ) => {
    executeOptimistic(runId, 'completed');
    const result = await actionFn(input);
    if (result.success) {
      removeItems([runId]);
      announce(`${actionLabel} — ${itemLabel}`);
    } else {
      handleError(runId, result.error?.message ?? 'Action failed');
      announce(`Failed to ${actionLabel.toLowerCase()} — ${itemLabel}`);
    }
  }, [executeOptimistic, removeItems, announce, handleError]);

  const onApprove = useCallback((id: string) => {
    void (async () => {
      const { approveRun } = await import('../actions/approve-run');
      const item = items.find((i) => i.run.id === id);
      const label = item
        ? `${AGENT_LABELS[item.run.agentId] ?? item.run.agentId} proposal`
        : id;
      await handleAction(id, approveRun, { runId: id }, 'Approved', label);
    })();
  }, [items, handleAction]);

  const onReject = useCallback((id: string) => {
    void (async () => {
      const { rejectRun } = await import('../actions/reject-run');
      const item = items.find((i) => i.run.id === id);
      const label = item
        ? `${AGENT_LABELS[item.run.agentId] ?? item.run.agentId} proposal`
        : id;
      await handleAction(id, rejectRun, { runId: id }, 'Rejected', label);
    })();
  }, [items, handleAction]);

  const onBatchApprove = useCallback((ids: string[]) => {
    void (async () => {
      const { batchApproveRuns } = await import('../actions/batch-approve-runs');
      const result = await batchApproveRuns({ runIds: ids });
      if (result.success) {
        removeItems(result.data.succeeded.map((s) => s.runId));
        result.data.failed.forEach((f) => handleError(f.runId, f.error));
        announce(`Batch approved ${result.data.succeeded.length} items${result.data.failed.length > 0 ? `, ${result.data.failed.length} failed` : ''}`);
      }
    })();
  }, [removeItems, handleError, announce]);

  const onBatchReject = useCallback((ids: string[]) => {
    void (async () => {
      const { batchRejectRuns } = await import('../actions/batch-reject-runs');
      const result = await batchRejectRuns({ runIds: ids });
      if (result.success) {
        removeItems(result.data.succeeded.map((s) => s.runId));
        result.data.failed.forEach((f) => handleError(f.runId, f.error));
        announce(`Batch rejected ${result.data.succeeded.length} items${result.data.failed.length > 0 ? `, ${result.data.failed.length} failed` : ''}`);
      }
    })();
  }, [removeItems, handleError, announce]);

  const handleModeChange = useCallback((newMode: string) => {
    if (newMode === 'edit') {
      setModeAnnouncement('Edit mode — shortcuts disabled');
    } else if (newMode === 'batch') {
      setModeAnnouncement('Batch mode — use Shift+A/R for batch actions');
    } else {
      setModeAnnouncement('Navigate mode — shortcuts active');
    }
  }, []);

  const {
    mode,
    focusedItemId,
    selectedItemIds,
    expandedItemId,
    modeIndicator,
    handleKeyDown,
    setFocusedItemId,
    setMode,
    setExpandedItemId,
  } = useTriageKeyboard({
    itemIds,
    onApprove,
    onReject,
    onBatchApprove,
    onBatchReject,
    onEdit: setEditingId,
    onExpand: () => {},
    onModeChange: handleModeChange,
  });

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-4" aria-hidden="true">{'\u2713'}</div>
        <p className="text-lg font-medium text-[var(--flow-text-primary)]">
          All clear — your agents handled everything.
        </p>
        <p className="mt-1 text-sm text-[var(--flow-text-secondary)]">
          {totalCount > 0 ? `${totalCount} items reviewed this session.` : 'No items pending.'}
        </p>
      </div>
    );
  }

  return (
    <div onKeyDown={handleKeyDown} tabIndex={-1}>
      <div id="approval-queue-start" className="sr-only">Approval queue — {items.length} items</div>

      <div
        ref={queueRef}
        role="list"
        aria-activedescendant={focusedItemId ? `proposal-${focusedItemId}` : undefined}
        aria-label="Approval queue"
        className="space-y-3 focus:outline-none"
      >
        {items.map((item) => (
          <QueueItemRow
            key={item.run.id}
            item={item}
            isEditing={editingId === item.run.id}
            isTimedOut={timedOutIds.has(item.run.id)}
            isExpanded={expandedItemId === item.run.id}
            isFocused={focusedItemId === item.run.id}
            isStale={staleIds.has(item.run.id)}
            isSelected={selectedItemIds.has(item.run.id)}
            errorMsg={errors.get(item.run.id)}
            onSetFocused={setFocusedItemId}
            onToggleExpand={setExpandedItemId}
            onSetEditing={setEditingId}
            onSetMode={setMode}
            onRemoveItems={removeItems}
            onAnnounce={announce}
          />
        ))}
      </div>

      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {modeAnnouncement}
      </div>

      <div className="fixed bottom-4 right-4 rounded-[var(--flow-radius-md)] bg-[var(--flow-bg-surface)] border border-[var(--flow-border-default)] px-3 py-1.5 text-xs font-medium text-[var(--flow-text-secondary)] shadow-[var(--flow-shadow-md)]" aria-hidden="true">
        {modeIndicator}
      </div>
    </div>
  );
}
