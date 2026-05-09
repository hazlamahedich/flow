'use client';

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { formatDuration } from '@/lib/format-duration';
import { softDeleteTimeEntryAction } from '../actions/soft-delete-time-entry';
import { listTimeEntriesAction } from '../actions/list-time-entries';
import { listProjectsAction } from '../actions/list-projects';
import { LogTimeModal } from './log-time-modal';
import type { WorkspaceMemberSummary } from '../actions/list-workspace-members';

interface ClientOption {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface TimeEntry {
  id: string;
  clientId: string;
  projectId: string | null;
  projectName: string | null;
  date: string;
  durationMinutes: number;
  notes: string | null;
  userId: string;
  createdAt: string;
}

interface TimeEntryListProps {
  initialEntries: TimeEntry[];
  initialTotal: number;
  initialPage: number;
  initialHasNextPage: boolean;
  clients: ClientOption[];
  members: WorkspaceMemberSummary[];
  workspaceId: string;
  userId: string;
  role: string;
}

type CreatedEntry = Omit<TimeEntry, 'userId' | 'createdAt' | 'projectName'>;

export function TimeEntryList({
  initialEntries,
  initialTotal,
  initialPage,
  initialHasNextPage,
  clients,
  members,
  workspaceId,
  userId,
  role,
}: TimeEntryListProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [filterClient, setFilterClient] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterProjects, setFilterProjects] = useState<ProjectOption[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterMember, setFilterMember] = useState('');
  const [loading, setLoading] = useState(false);

  const clientMap = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients],
  );

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.userId, m.displayName])),
    [members],
  );

  const handleCreated = useCallback((entry: CreatedEntry) => {
    const fullEntry: TimeEntry = { ...entry, projectName: null, userId, createdAt: new Date().toISOString() };
    setEntries((prev) => [fullEntry, ...prev]);
    setTotal((prev) => prev + 1);
    setShowModal(false);
  }, [userId]);

  const handleDelete = useCallback(async (id: string) => {
    setDeleteConfirmId(null);

    // Capture the entry and decrement total atomically inside the updater
    let capturedEntry: TimeEntry | undefined;
    setEntries((prev) => {
      capturedEntry = prev.find((e) => e.id === id);
      if (!capturedEntry) return prev;
      return prev.filter((e) => e.id !== id);
    });
    setTotal((prev) => (capturedEntry ? prev - 1 : prev));

    if (!capturedEntry) return;

    // Fire action OUTSIDE the updater to avoid React StrictMode double-invoke
    const result = await softDeleteTimeEntryAction({ id });
    if (!result.success) {
      const entry = capturedEntry;
      setEntries((cur) => [entry, ...cur].sort((a, b) => b.date.localeCompare(a.date)));
      setTotal((t) => t + 1);
    }
  }, []);

  const fetchPage = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const result = await listTimeEntriesAction({
        clientId: filterClient || undefined,
        projectId: filterProject || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
        userId: filterMember || undefined,
        page: targetPage,
      });
      if (result.success && result.data) {
        setEntries(result.data.items as TimeEntry[]);
        setTotal(result.data.total);
        setPage(result.data.page);
        setHasNextPage(result.data.hasNextPage);
      }
    } catch {
      toast.error('Failed to load entries — please try again');
    } finally {
      setLoading(false);
    }
  }, [filterClient, filterProject, filterDateFrom, filterDateTo, filterMember]);

  const handleApplyFilters = useCallback(() => fetchPage(1), [fetchPage]);

  const clearFilters = useCallback(async () => {
    setFilterClient('');
    setFilterProject('');
    setFilterProjects([]);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterMember('');
    setLoading(true);
    try {
      const result = await listTimeEntriesAction({ page: 1 });
      if (result.success && result.data) {
        setEntries(result.data.items as TimeEntry[]);
        setTotal(result.data.total);
        setPage(result.data.page);
        setHasNextPage(result.data.hasNextPage);
      }
    } catch {
      toast.error('Failed to load entries — please try again');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFilterClientChange = useCallback(async (clientId: string) => {
    setFilterClient(clientId);
    setFilterProject('');
    if (!clientId) {
      setFilterProjects([]);
      return;
    }
    try {
      const result = await listProjectsAction({ clientId });
      if (result.success && result.data) {
        setFilterProjects(result.data.map((p) => ({ id: p.id, name: p.name })));
      }
    } catch {
      setFilterProjects([]);
    }
  }, []);

  const getClientName = (cid: string) => clientMap.get(cid) ?? 'Unknown';

  const hasFilters = filterClient || filterProject || filterDateFrom || filterDateTo || filterMember;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Time</h1>
        <button
          className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
          onClick={() => setShowModal(true)}
        >
          Log Time
        </button>
      </div>

      {showModal && (
        <LogTimeModal
          clients={clients}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}

      <div className="mb-4 flex flex-wrap gap-2 rounded border p-3">
        <select
          className="rounded border bg-background px-2 py-1 text-sm"
          value={filterClient}
          onChange={(e) => handleFilterClientChange(e.target.value)}
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          className="rounded border bg-background px-2 py-1 text-sm"
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          disabled={!filterClient}
        >
          <option value="">All Projects</option>
          {filterProjects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <input
          type="date"
          className="rounded border bg-background px-2 py-1 text-sm"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
        />
        <input
          type="date"
          className="rounded border bg-background px-2 py-1 text-sm"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
        />

        {(role === 'owner' || role === 'admin') && members.length > 0 && (
          <select
            className="rounded border bg-background px-2 py-1 text-sm"
            value={filterMember}
            onChange={(e) => setFilterMember(e.target.value)}
          >
            <option value="">All Members</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>{m.displayName}</option>
            ))}
          </select>
        )}

        <button
          className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
          onClick={handleApplyFilters}
          disabled={loading}
        >
          {loading ? '...' : 'Filter'}
        </button>
        {hasFilters && (
          <button
            className="text-sm text-muted-foreground underline"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}
      </div>

      {entries.length === 0 && !hasFilters && (
        <div className="py-12 text-center">
          <p className="mb-4 text-muted-foreground">No time logged yet — log your first entry</p>
          <button
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => setShowModal(true)}
          >
            Log Time
          </button>
        </div>
      )}

      {entries.length === 0 && hasFilters && (
        <div className="py-12 text-center">
          <p className="mb-2 text-muted-foreground">No entries match your filters</p>
          <button className="text-sm text-primary underline" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Client</th>
                  <th className="px-2 py-2">Project</th>
                  <th className="px-2 py-2">Duration</th>
                  <th className="px-2 py-2">Notes</th>
                  <th className="px-2 py-2">Logged By</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="px-2 py-2">{entry.date}</td>
                    <td className="px-2 py-2">{getClientName(entry.clientId)}</td>
                    <td className="px-2 py-2">{entry.projectName ?? '—'}</td>
                    <td className="px-2 py-2">{formatDuration(entry.durationMinutes)}</td>
                    <td
                      className="max-w-[200px] truncate px-2 py-2"
                      title={entry.notes && entry.notes.length > 60 ? entry.notes : undefined}
                    >
                      {entry.notes
                        ? entry.notes.length > 60
                          ? entry.notes.slice(0, 60) + '...'
                          : entry.notes
                        : '—'}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">{memberMap.get(entry.userId) ?? entry.userId}</td>
                    <td className="px-2 py-2">
                      {(entry.userId === userId || role === 'owner' || role === 'admin') && (
                        deleteConfirmId === entry.id ? (
                          <span className="flex items-center gap-1">
                            <span className="text-xs">Delete this entry? This cannot be undone.</span>
                            <button
                              className="text-xs text-destructive underline"
                              onClick={() => handleDelete(entry.id)}
                            >
                              Confirm
                            </button>
                            <button
                              className="text-xs underline"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            className="text-xs text-destructive underline"
                            onClick={() => setDeleteConfirmId(entry.id)}
                          >
                            Delete
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} entries</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1 || loading}
                className="rounded border px-3 py-1 disabled:opacity-50"
                onClick={() => fetchPage(page - 1)}
              >
                Prev
              </button>
              <button
                disabled={!hasNextPage || loading}
                className="rounded border px-3 py-1 disabled:opacity-50"
                onClick={() => fetchPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
