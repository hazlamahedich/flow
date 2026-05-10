'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ProjectClientPicker } from './project-client-picker';
import { CollapsedTimer } from './collapsed-timer';
import { ExpandedTimer } from './expanded-timer';
import type { TimerShellProps, TimerStateWithNames } from './timer-types';

interface PersistentTimerProps {
  timerProps: TimerShellProps;
  collapsed: boolean;
}

interface RunningState {
  startedAt: Date;
  clientName: string | null;
  projectName: string | null;
  timerId: string;
}

const STALE_THRESHOLD_MS = 8 * 60 * 60 * 1000;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function PersistentTimer({ timerProps, collapsed }: PersistentTimerProps) {
  const [runningState, setRunningState] = useState<RunningState | null>(() => {
    const initial = timerProps.initialTimerState;
    if (initial) {
      return {
        startedAt: new Date(initial.startedAt),
        clientName: initial.clientName,
        projectName: initial.projectName,
        timerId: initial.id,
      };
    }
    return null;
  });
  const [displayElapsed, setDisplayElapsed] = useState('--:--:--');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // P2: synchronous guard to block double-start from rapid clicks before state flush
  const startingRef = useRef(false);

  const staleness = runningState
    ? Date.now() - runningState.startedAt.getTime() > STALE_THRESHOLD_MS
    : false;

  useEffect(() => {
    if (runningState) {
      const tick = () => {
        setDisplayElapsed(formatElapsed(Date.now() - runningState.startedAt.getTime()));
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      setDisplayElapsed('--:--:--');
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [runningState]);

  const handlePickerSelect = useCallback(
    (selection: {
      clientId: string;
      clientName: string;
      projectId: string | null;
      projectName: string | null;
    }) => {
      setSelectedClient({ id: selection.clientId, name: selection.clientName });
      setSelectedProject(
        selection.projectId
          ? { id: selection.projectId, name: selection.projectName ?? '' }
          : null,
      );
    },
    [],
  );

  const handleStart = useCallback(async () => {
    // P2: synchronous ref check before any state read/write to block double-clicks
    if (startingRef.current || !selectedClient || isLoading) return;
    startingRef.current = true;

    const optimistic: RunningState = {
      startedAt: new Date(),
      clientName: selectedClient.name,
      projectName: selectedProject?.name ?? null,
      timerId: '', // placeholder — handleStop guards against empty timerId
    };
    setRunningState(optimistic);
    setIsLoading(true);
    try {
      const result = await timerProps.onStart({
        clientId: selectedClient.id,
        projectId: selectedProject?.id ?? null,
      });
      if (result.success) {
        const d = result.data as TimerStateWithNames;
        setRunningState({
          startedAt: new Date(d.startedAt),
          clientName: d.clientName,
          projectName: d.projectName,
          timerId: d.id,
        });
      } else if (result.error.code === 'TIMER_ALREADY_RUNNING') {
        // P8 (AC12): a timer is running in another tab — fetch and display it
        const existing = await timerProps.onGetTimerState();
        if (existing.success && existing.data) {
          setRunningState({
            startedAt: new Date(existing.data.startedAt),
            clientName: existing.data.clientName,
            projectName: existing.data.projectName,
            timerId: existing.data.id,
          });
        } else {
          setRunningState(null);
          toast.error('A timer is already running');
        }
      } else {
        setRunningState(null);
        toast.error(result.error.message);
      }
    } catch {
      setRunningState(null);
      toast.error('Failed to start timer');
    } finally {
      setIsLoading(false);
      startingRef.current = false;
    }
  }, [selectedClient, selectedProject, isLoading, timerProps]);

  const handleStop = useCallback(async () => {
    // P1: guard against stop being called during the optimistic window when timerId is still ''
    if (!runningState || !runningState.timerId || isLoading) return;
    const prev = runningState;
    setRunningState(null);
    setIsLoading(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try {
      const result = await timerProps.onStop(prev.timerId);
      if (result.success) {
        // P4: only clear picker selection on successful stop
        setSelectedClient(null);
        setSelectedProject(null);
        toast.success(`Logged ${result.data.durationMinutes} min`);
      } else {
        setRunningState(prev);
        toast.error(result.error.message);
      }
    } catch {
      setRunningState(prev);
      toast.error('Failed to stop timer');
    } finally {
      setIsLoading(false);
    }
  }, [runningState, isLoading, timerProps]);

  const startDisabled = !selectedClient || isLoading;
  const clientLabel = runningState?.clientName ?? '(unknown client)';
  const label = runningState
    ? runningState.projectName
      ? `${clientLabel} · ${runningState.projectName} · ${displayElapsed}`
      : `${clientLabel} · ${displayElapsed}`
    : 'Timer';

  if (collapsed) {
    return (
      <CollapsedTimer
        runningState={runningState}
        displayElapsed={displayElapsed}
        label={label}
        staleness={staleness}
        onStop={handleStop}
        isLoading={isLoading}
      />
    );
  }

  return (
    <ExpandedTimer
      runningState={runningState}
      label={label}
      staleness={staleness}
      isLoading={isLoading}
      onStart={handleStart}
      onStop={handleStop}
      startDisabled={startDisabled}
      pickerSlot={
        <ProjectClientPicker
          timerProps={timerProps}
          onSelect={handlePickerSelect}
          disabled={isLoading}
        />
      }
    />
  );
}
