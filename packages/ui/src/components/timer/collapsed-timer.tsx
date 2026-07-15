'use client';

import { useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { cn } from '../../lib/utils';

interface RunningState {
  startedAt: Date;
  clientName: string | null;
  projectName: string | null;
  timerId: string;
}

export interface CollapsedTimerProps {
  runningState: RunningState | null;
  displayElapsed: string;
  label: string;
  staleness: boolean;
  onStop: () => void;
  isLoading: boolean;
}

export function CollapsedTimer({
  runningState,
  displayElapsed,
  label,
  staleness,
  onStop,
  isLoading,
}: CollapsedTimerProps) {
  const [open, setOpen] = useState(false);
  // Delay closing so mouse can travel from trigger to portal-rendered content
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpenHover = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpen(true);
  };

  const handleCloseHover = () => {
    closeTimeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  if (!runningState) {
    return (
      <div className="flex items-center justify-center">
        <Clock
          className="h-5 w-5 opacity-50 text-[var(--flow-color-text-muted)]"
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center justify-center rounded-[var(--flow-radius-sm)] p-1.5 transition-colors hover:bg-[var(--flow-state-overlay-hover)]',
            staleness && 'text-yellow-600 dark:text-yellow-400',
          )}
          data-testid="sidebar-timer-collapsed-trigger"
          aria-label={`Timer: ${label}`}
          onMouseEnter={handleOpenHover}
          onMouseLeave={handleCloseHover}
        >
          <Clock
            className={cn(
              'h-5 w-5 animate-pulse',
              staleness
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-[var(--flow-color-accent-gold)]',
            )}
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        className="w-56 p-3"
        sideOffset={8}
        onMouseEnter={handleOpenHover}
        onMouseLeave={handleCloseHover}
      >
        <div className="space-y-2">
          <div
            className="font-mono text-sm font-medium"
            aria-label="Elapsed time"
          >
            {displayElapsed}
          </div>
          <div
            className="text-xs text-[var(--flow-color-text-secondary)]"
            aria-label="Client and project"
          >
            {runningState.clientName ?? '(unknown client)'}
            {runningState.projectName ? ` · ${runningState.projectName}` : ''}
          </div>
          {staleness && (
            <div className="text-xs text-yellow-600 dark:text-yellow-400">
              Running for{' '}
              {Math.floor(
                (Date.now() - runningState.startedAt.getTime()) / 3600000,
              )}
              h — did you forget to stop it?
            </div>
          )}
          <button
            type="button"
            onClick={onStop}
            disabled={isLoading}
            className="w-full rounded-[var(--flow-radius-sm)] bg-[var(--flow-status-error)] px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Stop
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
