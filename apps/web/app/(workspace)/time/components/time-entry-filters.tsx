'use client';

import { useCallback } from 'react';
import { listProjectsAction } from '../actions/list-projects';
import type { WorkspaceMemberSummary } from '../actions/list-workspace-members';

interface ClientOption {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface TimeEntryFiltersProps {
  clients: ClientOption[];
  members: WorkspaceMemberSummary[];
  role: string;
  filterClient: string;
  filterProject: string;
  filterProjects: ProjectOption[];
  filterDateFrom: string;
  filterDateTo: string;
  filterMember: string;
  loading: boolean;
  onClientChange: (clientId: string) => void;
  onProjectChange: (projectId: string) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onMemberChange: (userId: string) => void;
  onApply: () => void;
  onClear: () => void;
}

export function TimeEntryFilters({
  clients,
  members,
  role,
  filterClient,
  filterProject,
  filterProjects,
  filterDateFrom,
  filterDateTo,
  filterMember,
  loading,
  onClientChange,
  onProjectChange,
  onDateFromChange,
  onDateToChange,
  onMemberChange,
  onApply,
  onClear,
}: TimeEntryFiltersProps) {
  const hasFilters = filterClient || filterProject || filterDateFrom || filterDateTo || filterMember;

  return (
    <div className="mb-4 flex flex-wrap gap-2 rounded border p-3">
      <select
        className="rounded border bg-background px-2 py-1 text-sm"
        value={filterClient}
        onChange={(e) => onClientChange(e.target.value)}
      >
        <option value="">All Clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <select
        className="rounded border bg-background px-2 py-1 text-sm"
        value={filterProject}
        onChange={(e) => onProjectChange(e.target.value)}
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
        onChange={(e) => onDateFromChange(e.target.value)}
      />
      <input
        type="date"
        className="rounded border bg-background px-2 py-1 text-sm"
        value={filterDateTo}
        onChange={(e) => onDateToChange(e.target.value)}
      />

      {(role === 'owner' || role === 'admin') && members.length > 0 && (
        <select
          className="rounded border bg-background px-2 py-1 text-sm"
          value={filterMember}
          onChange={(e) => onMemberChange(e.target.value)}
        >
          <option value="">All Members</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>{m.displayName}</option>
          ))}
        </select>
      )}

      <button
        className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
        onClick={onApply}
        disabled={loading}
      >
        {loading ? '...' : 'Filter'}
      </button>
      {hasFilters && (
        <button
          className="text-sm text-muted-foreground underline"
          onClick={onClear}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
