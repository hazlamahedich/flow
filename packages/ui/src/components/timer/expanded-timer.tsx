'use client';

import { Clock } from 'lucide-react';

interface RunningState {
  startedAt: Date;
  clientName: string | null;
  projectName: string | null;
  timerId: string;
}

interface ExpandedTimerProps {
  runningState: RunningState | null;
  label: string;
  staleness: boolean;
  isLoading: boolean;
  onStart: () => void;
  onStop: () => void;
  startDisabled: boolean;
  pickerSlot: React.ReactNode;
}

export function ExpandedTimer({
  runningState,
  label,
  staleness,
  isLoading,
  onStart,
  onStop,
  startDisabled,
  pickerSlot,
}: ExpandedTimerProps) {
  return (
    <div className="space-y-1.5">
      {staleness && runningState && (
        <div
          className="flex items-center gap-1.5 rounded-[var(--flow-radius-sm)] bg-yellow-100 px-2 py-1 text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
          data-testid="sidebar-timer-stale-warning"
        >
          <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            Timer running for {Math.floor((Date.now() - runningState.startedAt.getTime()) / 3600000)}h — did you forget to stop it?
          </span>
          <button
            type="button"
            onClick={onStop}
            disabled={isLoading}
            className="ml-auto shrink-0 rounded-[var(--flow-radius-sm)] bg-yellow-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
          >
            Stop
          </button>
        </div>
      )}

      {runningState ? (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-[var(--flow-color-text-primary)] truncate" data-testid="sidebar-timer-display">
            {label}
          </span>
        </div>
      ) : (
        pickerSlot
      )}

      {runningState ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onStop}
            disabled={isLoading}
            className="ml-auto rounded-[var(--flow-radius-sm)] bg-[var(--flow-status-error)] px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            data-testid="sidebar-timer-stop"
          >
            Stop
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onStart}
            disabled={startDisabled}
            title={startDisabled && !isLoading ? 'Select a client to start the timer' : undefined}
            className="w-full rounded-[var(--flow-radius-sm)] bg-[var(--flow-color-accent-gold)] px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="sidebar-timer-start"
          >
            {isLoading ? 'Starting...' : 'Start'}
          </button>
        </div>
      )}
    </div>
  );
}
