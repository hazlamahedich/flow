'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { createTimeEntryAction } from '../actions/create-time-entry';
import { createProjectAction } from '../actions/create-project';
import { listProjectsAction } from '../actions/list-projects';
import { timeToMinutes } from '../utils/time-conversion';

interface ClientOption {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  name: string;
  clientId: string;
}

interface LogTimeModalProps {
  clients: ClientOption[];
  onClose: () => void;
  onCreated: (entry: {
    id: string;
    clientId: string;
    projectId: string | null;
    date: string;
    durationMinutes: number;
    startMinutes: number | null;
    endMinutes: number | null;
    notes: string | null;
  }) => void;
}

export function LogTimeModal({
  clients,
  onClose,
  onCreated,
}: LogTimeModalProps) {
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [durationManuallySet, setDurationManuallySet] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);

  const [showProjectCreate, setShowProjectCreate] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectCreateError, setProjectCreateError] = useState<string | null>(
    null,
  );

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (!clientId) {
      setProjects([]);
      setProjectId(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    listProjectsAction({ clientId })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.success && result.data) {
          setProjects(result.data as ProjectOption[]);
        } else {
          setProjects([]);
        }
        setProjectId(null);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setProjects([]);
        setProjectId(null);
      });

    return () => {
      controller.abort();
    };
  }, [clientId]);

  useEffect(() => {
    if (startTime && endTime && !durationManuallySet) {
      const start = timeToMinutes(startTime);
      const end = timeToMinutes(endTime);
      if (end > start) {
        setDurationMinutes(String(end - start));
      }
    }
  }, [startTime, endTime, durationManuallySet]);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim() || !clientId || isCreatingProject) return;
    setProjectCreateError(null);
    setIsCreatingProject(true);

    const result = await createProjectAction({
      clientId,
      name: newProjectName.trim(),
    });
    if (result.success && result.data) {
      const newProj: ProjectOption = {
        id: result.data.id,
        name: result.data.name,
        clientId: result.data.clientId,
      };
      setProjects((prev) => [...prev, newProj]);
      setProjectId(newProj.id);
      setNewProjectName('');
      setShowProjectCreate(false);
    } else if (!result.success) {
      setProjectCreateError(
        result.error.code === 'CONFLICT'
          ? 'A project with this name already exists'
          : 'Failed to create project',
      );
    }
    setIsCreatingProject(false);
  }, [newProjectName, clientId, isCreatingProject]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const duration = parseInt(durationMinutes, 10);
    if (!clientId) {
      setError('Client is required');
      return;
    }
    if (!duration || duration < 1) {
      setError('Minimum 1 minute');
      return;
    }
    if (duration > 1440) {
      setError('Maximum 1440 minutes');
      return;
    }
    if (!date) {
      setError('Date is required');
      return;
    }

    const hasStart = startTime != null && startTime !== '';
    const hasEnd = endTime != null && endTime !== '';
    if (hasStart !== hasEnd) {
      setTimeError('Both start and end times are required together.');
      return;
    }
    setTimeError(null);

    setSubmitting(true);
    const result = await createTimeEntryAction({
      clientId,
      projectId,
      date,
      durationMinutes: duration,
      ...(hasStart && hasEnd
        ? {
            startMinutes: timeToMinutes(startTime!),
            endMinutes: timeToMinutes(endTime!),
          }
        : {}),
      notes: notes || undefined,
    });

    if (result.success && result.data) {
      toast.success('Time logged');
      onCreated({
        id: result.data.id,
        clientId,
        projectId,
        date,
        durationMinutes: duration,
        startMinutes: hasStart && hasEnd ? timeToMinutes(startTime!) : null,
        endMinutes: hasStart && hasEnd ? timeToMinutes(endTime!) : null,
        notes: notes || null,
      });
      setSubmitting(false);
      onClose();
    } else {
      toast.error('Failed to log time — try again');
      setError(
        result.success === false && result.error
          ? result.error.message
          : 'Failed to log time — try again',
      );
      setSubmitting(false);
    }
  }, [
    clientId,
    projectId,
    date,
    durationMinutes,
    startTime,
    endTime,
    notes,
    onCreated,
    onClose,
  ]);

  const clientProjects = projects.filter((p) => p.clientId === clientId);
  const hasNoProjects = clientId && clientProjects.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Log time entry"
        className="bg-background w-full max-w-lg rounded-lg border p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Log Time</h2>

        {error && (
          <div className="mb-3 rounded bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Client *</label>
            <select
              className="w-full rounded border bg-background p-2"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Project</label>
            <select
              className="w-full rounded border bg-background p-2"
              value={projectId ?? ''}
              onChange={(e) => {
                if (e.target.value === '__add__') {
                  setShowProjectCreate(true);
                  return;
                }
                setProjectId(e.target.value || null);
                setShowProjectCreate(false);
              }}
              disabled={!clientId}
            >
              <option value="">No Project</option>
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {hasNoProjects && (
                <option value="__add__">No projects — Add one</option>
              )}
            </select>

            {showProjectCreate && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded border bg-background p-2 text-sm"
                  placeholder="Project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  maxLength={100}
                />
                <button
                  type="button"
                  className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || isCreatingProject}
                >
                  Add
                </button>
              </div>
            )}
            {projectCreateError && (
              <p className="mt-1 text-xs text-destructive">
                {projectCreateError}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Date *</label>
            <input
              type="date"
              className="w-full rounded border bg-background p-2"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Start Time
              </label>
              <input
                type="time"
                className="w-full rounded border bg-background p-2"
                value={startTime ?? ''}
                onChange={(e) => {
                  setStartTime(e.target.value || null);
                  setTimeError(null);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">End Time</label>
              <input
                type="time"
                className="w-full rounded border bg-background p-2"
                value={endTime ?? ''}
                onChange={(e) => {
                  setEndTime(e.target.value || null);
                  setTimeError(null);
                }}
              />
            </div>
          </div>
          {timeError && <p className="text-sm text-destructive">{timeError}</p>}

          <div>
            <label className="mb-1 block text-sm font-medium">Minutes *</label>
            <input
              type="number"
              className="w-full rounded border bg-background p-2"
              min={1}
              max={1440}
              step={1}
              value={durationMinutes}
              onChange={(e) => {
                setDurationMinutes(e.target.value);
                setDurationManuallySet(true);
              }}
              placeholder="e.g. 90 for 1h 30m"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Notes</label>
            <textarea
              className="w-full rounded border bg-background p-2"
              maxLength={500}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              {notes.length}/500
            </span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border px-4 py-2 text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Logging...' : 'Log Time'}
          </button>
        </div>
      </div>
    </div>
  );
}
