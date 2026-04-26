'use client';

import { CEREMONY_COPY } from '../constants/trust-copy';

interface CeremonyStepStatsProps {
  cleanApprovals: number;
  totalRuns: number;
  daysAtLevel: number;
}

export function CeremonyStepStats({
  cleanApprovals,
  totalRuns,
  daysAtLevel,
}: CeremonyStepStatsProps) {
  return (
    <p className="text-sm text-[var(--flow-color-text-secondary)]">
      {CEREMONY_COPY.upgrade.stats(cleanApprovals, totalRuns, daysAtLevel)}
    </p>
  );
}

interface CeremonyStepAcknowledgeProps {
  agentLabel: string;
  actionLabel: string;
  escapeInstruction: string;
}

export function CeremonyStepAcknowledge({
  agentLabel,
  actionLabel,
  escapeInstruction,
}: CeremonyStepAcknowledgeProps) {
  return (
    <div className="space-y-2">
      <p className="sr-only">{escapeInstruction}</p>
      <h2 className="text-lg font-semibold text-[var(--flow-color-text-primary)]">
        {CEREMONY_COPY.upgrade.title(agentLabel)}
      </h2>
      <p className="text-sm text-[var(--flow-color-text-secondary)]">
        {CEREMONY_COPY.upgrade.body(agentLabel, actionLabel)}
      </p>
    </div>
  );
}

interface CeremonyStepConfirmProps {
  onAccept: () => void;
  onDecline: () => void;
  onRemindLater: () => void;
  declineRef: React.RefObject<HTMLButtonElement | null>;
  loading?: boolean;
}

export function CeremonyStepConfirm({
  onAccept,
  onDecline,
  onRemindLater,
  declineRef,
  loading = false,
}: CeremonyStepConfirmProps) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onAccept}
        disabled={loading}
        className="rounded-md bg-[var(--flow-color-bg-surface-raised)] px-4 py-2 text-sm font-medium text-[var(--flow-color-text-primary)] hover:bg-[var(--flow-color-bg-surface-hover)] focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)] disabled:opacity-50"
      >
        {loading ? 'Saving…' : CEREMONY_COPY.upgrade.accept}
      </button>
      <button
        ref={declineRef}
        type="button"
        onClick={onDecline}
        disabled={loading}
        className="rounded-md px-4 py-2 text-sm font-medium text-[var(--flow-color-text-secondary)] hover:text-[var(--flow-color-text-primary)] focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)] disabled:opacity-50"
      >
        {CEREMONY_COPY.upgrade.decline}
      </button>
      <button
        type="button"
        onClick={onRemindLater}
        disabled={loading}
        className="rounded-md px-4 py-2 text-sm font-medium text-[var(--flow-color-text-tertiary)] hover:text-[var(--flow-color-text-secondary)] focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)] disabled:opacity-50"
      >
        {CEREMONY_COPY.upgrade.remindLater}
      </button>
    </div>
  );
}
