import type { ActionResult } from '@flow/types';
import type { TimerStateWithNames } from '@flow/db';

export type { TimerStateWithNames };

export interface TimerShellProps {
  initialTimerState: TimerStateWithNames | null;
  onStart: (input: {
    clientId: string;
    projectId: string | null;
    notes?: string;
  }) => Promise<ActionResult<TimerStateWithNames>>;
  onStop: (
    timerId: string,
  ) => Promise<ActionResult<{ timeEntryId: string; durationMinutes: number }>>;
  onGetTimerState: () => Promise<ActionResult<TimerStateWithNames | null>>;
  onListClients: () => Promise<ActionResult<{ id: string; name: string }[]>>;
  onListProjects: (
    clientId: string,
  ) => Promise<ActionResult<{ id: string; name: string; clientId: string }[]>>;
}
