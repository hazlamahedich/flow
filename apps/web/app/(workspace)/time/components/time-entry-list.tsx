'use client';

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { formatDuration } from '@/lib/format-duration';
import { softDeleteTimeEntryAction } from '../actions/soft-delete-time-entry';
import { listTimeEntriesAction } from '../actions/list-time-entries';
import { listProjectsAction } from '../actions/list-projects';
import { LogTimeModal } from './log-time-modal';
import { EditTimeEntryModal } from './edit-time-entry-modal';
import type { EditTimeEntryResult } from './edit-time-entry-modal';
import { TimeEntryFilters } from './time-entry-filters';
import type { WorkspaceMemberSummary } from '../actions/schemas';

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
  startMinutes: number | null;
  endMinutes: number | null;
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
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

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

  const handleCreated = useCallback(
    (entry: CreatedEntry) => {
      const full: TimeEntry = {
        ...entry,
        projectName: null,
        userId,
        createdAt: new Date().toISOString(),
      };
      setEntries((prev) => [full, ...prev]);
      setTotal((prev) => prev + 1);
      setShowModal(false);
    },
    [userId],
  );

  const handleDelete = useCallback(async (id: string) => {
    setDeleteConfirmId(null);
    let captured: TimeEntry | undefined;
    setEntries((prev) => {
      captured = prev.find((e) => e.id === id);
      return captured ? prev.filter((e) => e.id !== id) : prev;
    });
    setTotal((prev) => (captured ? prev - 1 : prev));
    if (!captured) return;
    const result = await softDeleteTimeEntryAction({ id });
    if (!result.success && captured) {
      const entry = captured;
      setEntries((cur) =>
        [entry, ...cur].sort((a, b) => b.date.localeCompare(a.date)),
      );
      setTotal((t) => t + 1);
    }
  }, []);

  const handleUpdated = useCallback((updated: EditTimeEntryResult) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== updated.id) return e;
        return {
          ...e,
          date: updated.date ?? e.date,
          durationMinutes: updated.durationMinutes ?? e.durationMinutes,
          clientId: updated.clientId ?? e.clientId,
          projectId:
            updated.projectId !== undefined ? updated.projectId : e.projectId,
          notes: updated.notes !== undefined ? updated.notes : e.notes,
          projectName:
            updated.projectName !== undefined
              ? updated.projectName
              : e.projectName,
          startMinutes:
            updated.startMinutes !== undefined
              ? updated.startMinutes
              : e.startMinutes,
          endMinutes:
            updated.endMinutes !== undefined
              ? updated.endMinutes
              : e.endMinutes,
        };
      }),
    );
    setEditingEntry(null);
  }, []);

  const fetchPage = useCallback(
    async (targetPage: number) => {
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
        toast.error('Failed to load entries');
      } finally {
        setLoading(false);
      }
    },
    [filterClient, filterProject, filterDateFrom, filterDateTo, filterMember],
  );

  const handleFilterClientChange = useCallback(async (clientId: string) => {
    setFilterClient(clientId);
    setFilterProject('');
    if (!clientId) {
      setFilterProjects([]);
      return;
    }
    try {
      const result = await listProjectsAction({ clientId });
      if (result.success && result.data)
        setFilterProjects(result.data.map((p) => ({ id: p.id, name: p.name })));
    } catch {
      setFilterProjects([]);
    }
  }, []);

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
      toast.error('Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, []);

  const getClientName = (cid: string) => clientMap.get(cid) ?? 'Unknown';
  const hasFilters =
    filterClient ||
    filterProject ||
    filterDateFrom ||
    filterDateTo ||
    filterMember;
  const canEdit = (entry: TimeEntry) =>
    entry.userId === userId || role === 'owner' || role === 'admin';

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
      {editingEntry && (
        <EditTimeEntryModal
          entry={editingEntry}
          clients={clients}
          onClose={() => setEditingEntry(null)}
          onUpdated={handleUpdated}
        />
      )}

      <TimeEntryFilters
        clients={clients}
        members={members}
        role={role}
        filterClient={filterClient}
        filterProject={filterProject}
        filterProjects={filterProjects}
        filterDateFrom={filterDateFrom}
        filterDateTo={filterDateTo}
        filterMember={filterMember}
        loading={loading}
        onClientChange={handleFilterClientChange}
        onProjectChange={setFilterProject}
        onDateFromChange={setFilterDateFrom}
        onDateToChange={setFilterDateTo}
        onMemberChange={setFilterMember}
        onApply={() => fetchPage(1)}
        onClear={clearFilters}
      />

      {entries.length === 0 && !hasFilters && (
        <div className="py-12 text-center">
          <p className="mb-4 text-muted-foreground">
            No time logged yet — use the button above to record your first entry
          </p>
        </div>
      )}

      {entries.length === 0 && hasFilters && (
        <div className="py-12 text-center">
          <p className="mb-2 text-muted-foreground">
            No entries match your filters — use the Clear filters control above
            to widen your search
          </p>
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
                    <td className="px-2 py-2">
                      {getClientName(entry.clientId)}
                    </td>
                    <td className="px-2 py-2">{entry.projectName ?? '—'}</td>
                    <td className="px-2 py-2">
                      {formatDuration(entry.durationMinutes)}
                    </td>
                    <td
                      className="max-w-[200px] truncate px-2 py-2"
                      title={
                        entry.notes && entry.notes.length > 60
                          ? entry.notes
                          : undefined
                      }
                    >
                      {entry.notes
                        ? entry.notes.length > 60
                          ? entry.notes.slice(0, 60) + '...'
                          : entry.notes
                        : '—'}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">
                      {memberMap.get(entry.userId) ?? entry.userId}
                    </td>
                    <td className="px-2 py-2">
                      {canEdit(entry) && (
                        <span className="flex items-center gap-2">
                          <button
                            className="text-xs text-primary underline"
                            onClick={() => setEditingEntry(entry)}
                            aria-label="Edit time entry"
                          >
                            <Pencil className="inline h-3.5 w-3.5" />
                          </button>
                          {deleteConfirmId === entry.id ? (
                            <span className="flex items-center gap-1">
                              <span className="text-xs">Delete?</span>
                              <button
                                className="text-xs text-destructive underline"
                                onClick={() => handleDelete(entry.id)}
                              >
                                Yes
                              </button>
                              <button
                                className="text-xs underline"
                                onClick={() => setDeleteConfirmId(null)}
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              className="text-xs text-destructive underline"
                              onClick={() => setDeleteConfirmId(entry.id)}
                            >
                              Delete
                            </button>
                          )}
                        </span>
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
