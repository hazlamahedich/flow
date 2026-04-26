'use client';

import Link from 'next/link';
import { Badge } from '@flow/ui';
import type { Client } from '@flow/types';

interface ClientTableProps {
  clients: Client[];
  sortBy: string;
  sortOrder: string;
  onSort: (column: string) => void;
}

const statusDisplay = {
  active: { label: 'Active', variant: 'success' as const },
  archived: { label: 'Archived', variant: 'secondary' as const },
};

const defaultDisplay = { label: 'Active', variant: 'success' as const };

export function ClientTable({ clients, sortBy, sortOrder, onSort }: ClientTableProps) {
  const SortHeader = ({ column, children }: { column: string; children: React.ReactNode }) => (
    <th
      className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase text-[var(--flow-color-text-secondary)] hover:text-[var(--flow-color-text-primary)]"
      onClick={() => onSort(column)}
    >
      <span className="flex items-center gap-1">
        {children}
        {sortBy === column && (
          <span className="text-[10px]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--flow-color-border-default)]">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface-secondary)]">
          <tr>
            <SortHeader column="name">Name</SortHeader>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--flow-color-text-secondary)]">
              Company
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--flow-color-text-secondary)]">
              Email
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-[var(--flow-color-text-secondary)]">
              Status
            </th>
            <SortHeader column="created_at">Created</SortHeader>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => {
            const display = client.status in statusDisplay ? statusDisplay[client.status as keyof typeof statusDisplay] : defaultDisplay;
            return (
              <tr
                key={client.id}
                className="border-b border-[var(--flow-color-border-default)] transition-colors hover:bg-[var(--flow-color-bg-surface-secondary)]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-medium text-[var(--flow-color-text-brand)] hover:underline"
                  >
                    {client.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--flow-color-text-secondary)]">
                  {client.companyName ?? '—'}
                </td>
                <td className="px-4 py-3 text-[var(--flow-color-text-secondary)]">
                  {client.email ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={display.variant}>{display.label}</Badge>
                </td>
                <td className="px-4 py-3 text-[var(--flow-color-text-secondary)]">
                  {new Date(client.createdAt).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
