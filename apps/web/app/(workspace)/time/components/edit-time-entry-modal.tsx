'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { updateTimeEntryAction } from '../actions/update-time-entry';
import { checkEntryInvoicedAction } from '../actions/check-entry-invoiced';
import { listProjectsAction } from '../actions/list-projects';
import { InvoiceWarningBanner } from './invoice-warning-banner';
import { timeToMinutes, minutesToTime } from '../utils/time-conversion';

interface ClientOption {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  name: string;
  clientId: string;
}

interface TimeEntryData {
  id: string;
  clientId: string;
  projectId: string | null;
  date: string;
  durationMinutes: number;
  startMinutes: number | null;
  endMinutes: number | null;
  notes: string | null;
}

export interface EditTimeEntryResult {
  id: string;
  updatedAt: string;
  date?: string;
  durationMinutes?: number;
  startMinutes?: number | null;
  endMinutes?: number | null;
  clientId?: string;
  projectId?: string | null;
  projectName?: string | null;
  notes?: string | null;
}

interface EditTimeEntryModalProps {
  entry: TimeEntryData;
  clients: ClientOption[];
  onClose: () => void;
  onUpdated: (updated: EditTimeEntryResult) => void;
}

export function EditTimeEntryModal({ entry, clients, onClose, onUpdated }: EditTimeEntryModalProps) {
  const [clientId, setClientId] = useState(entry.clientId);
  const [projectId, setProjectId] = useState<string | null>(entry.projectId);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [date, setDate] = useState(entry.date);
  const [startTime, setStartTime] = useState<string | null>(
    entry.startMinutes != null ? minutesToTime(entry.startMinutes) : null,
  );
  const [endTime, setEndTime] = useState<string | null>(
    entry.endMinutes != null ? minutesToTime(entry.endMinutes) : null,
  );
  const [durationMinutes, setDurationMinutes] = useState(String(entry.durationMinutes));
  const [durationManuallySet, setDurationManuallySet] = useState(false);
  const [notes, setNotes] = useState(entry.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);

  const [invoiced, setInvoiced] = useState(false);
  const [invoicedAcknowledged, setInvoicedAcknowledged] = useState(false);
  const [invoicedLoading, setInvoicedLoading] = useState(true);

  const invoicedMounted = useRef(true);
  const projectsMounted = useRef(true);

  useEffect(() => {
    invoicedMounted.current = true;
    checkEntryInvoicedAction({ entryId: entry.id })
      .then((result) => {
        if (invoicedMounted.current && result.success && result.data) {
          setInvoiced(result.data.invoiced);
        }
      })
      .finally(() => {
        if (invoicedMounted.current) setInvoicedLoading(false);
      });
    return () => { invoicedMounted.current = false; };
  }, [entry.id]);

  useEffect(() => {
    projectsMounted.current = true;
    if (!clientId) {
      setProjects([]);
      return;
    }
    listProjectsAction({ clientId })
      .then((result) => {
        if (projectsMounted.current) {
          if (result.success && result.data) {
            setProjects(result.data as ProjectOption[]);
          } else {
            setProjects([]);
          }
        }
      })
      .catch(() => { if (projectsMounted.current) setProjects([]); });
    return () => { projectsMounted.current = false; };
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

  const handleSubmit = useCallback(async () => {
    setError(null);
    const duration = parseInt(durationMinutes, 10);
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
    try {
      const result = await updateTimeEntryAction({
        id: entry.id,
        date,
        durationMinutes: duration,
        ...(hasStart && hasEnd
          ? { startMinutes: timeToMinutes(startTime!), endMinutes: timeToMinutes(endTime!) }
          : { startMinutes: null, endMinutes: null }),
        clientId: clientId || null,
        projectId,
        notes: notes || null,
        invoicedAcknowledged: invoicedAcknowledged || undefined,
      });

      if (result.success && result.data) {
        toast.success('Time entry updated.');
        onUpdated({
          ...result.data,
          date,
          durationMinutes: duration,
          startMinutes: hasStart && hasEnd ? timeToMinutes(startTime!) : null,
          endMinutes: hasStart && hasEnd ? timeToMinutes(endTime!) : null,
          clientId: clientId || undefined,
          projectId,
          notes: notes || null,
          projectName: projectId ? projects.find((p) => p.id === projectId)?.name ?? null : null,
        });
        onClose();
      } else if (!result.success) {
        if (result.error.code === 'INVOICED_ENTRY_WARNING') {
          setInvoiced(true);
          setError(result.error.message);
        } else {
          toast.error(result.error.message);
          setError(result.error.message);
        }
      }
    } catch {
      toast.error('Failed to update time entry');
    } finally {
      setSubmitting(false);
    }
  }, [entry.id, date, durationMinutes, startTime, endTime, clientId, projectId, notes, invoicedAcknowledged, onUpdated, onClose, projects]);

  const canSubmit = !submitting && (!invoiced || invoicedAcknowledged);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !submitting && canSubmit) handleSubmit();
    if (e.key === 'Escape') onClose();
  }, [handleSubmit, onClose, submitting, canSubmit]);

  const clientProjects = projects.filter((p) => p.clientId === clientId);

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const handleBackdropClick = useCallback(() => {
    if (!submitting) onClose();
  }, [submitting, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleBackdropClick}>
      <div
        className="bg-background w-full max-w-lg rounded-lg border p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 className="mb-4 text-lg font-semibold">Edit Time Entry</h2>

        {invoiced && !invoicedLoading && (
          <InvoiceWarningBanner
            acknowledged={invoicedAcknowledged}
            onAcknowledge={setInvoicedAcknowledged}
          />
        )}

        {error && (
          <div className="mb-3 rounded bg-destructive/10 p-2 text-sm text-destructive">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Client *</label>
            <select
              className="w-full rounded border bg-background p-2"
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setProjectId(null); }}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Project</label>
            <select
              className="w-full rounded border bg-background p-2"
              value={projectId ?? ''}
              onChange={(e) => setProjectId(e.target.value || null)}
              disabled={!clientId}
            >
              <option value="">No Project</option>
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
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
              <label className="mb-1 block text-sm font-medium">Start Time</label>
              <input
                type="time"
                className="w-full rounded border bg-background p-2"
                value={startTime ?? ''}
                onChange={(e) => { setStartTime(e.target.value || null); setTimeError(null); }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">End Time</label>
              <input
                type="time"
                className="w-full rounded border bg-background p-2"
                value={endTime ?? ''}
                onChange={(e) => { setEndTime(e.target.value || null); setTimeError(null); }}
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
            <span className="text-xs text-muted-foreground">{notes.length}/500</span>
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
            disabled={!canSubmit}
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
