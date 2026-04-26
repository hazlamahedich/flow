'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Client, ClientListFilters } from '@flow/types';
import { ClientTable } from './client-table';
import { ClientEmptyState } from './client-empty-state';
import { CreateClientDialog } from './create-client-dialog';
import { TierLimitBanner } from './tier-limit-banner';

interface ClientListProps {
  clients: Client[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  activeCount: number;
  tierLimit: number;
  tierName: string;
  filters: ClientListFilters;
  role: string;
}

export function ClientList({
  clients,
  total,
  page,
  hasNextPage,
  activeCount,
  tierLimit,
  tierName,
  filters,
  role,
}: ClientListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(filters.search ?? '');
  const [statusFilter, setStatusFilter] = useState<string>(filters.status ?? 'all');

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`/clients?${params.toString()}`);
  };

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) {
      params.set('search', search.trim());
    } else {
      params.delete('search');
    }
    params.delete('page');
    router.push(`/clients?${params.toString()}`);
  };

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p > 1) {
      params.set('page', String(p));
    } else {
      params.delete('page');
    }
    router.push(`/clients?${params.toString()}`);
  };

  const isFiltered = (filters.search || filters.status) ?? false;
  const noClientsAtAll = total === 0 && !isFiltered;
  const noFilterResults = total === 0 && isFiltered;
  const isScopedMember = role === 'member';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Clients
        </h1>
        {role !== 'member' && (
          <CreateClientDialog activeCount={activeCount} />
        )}
      </div>

      <TierLimitBanner activeCount={activeCount} limit={tierLimit} tierName={tierName} />

      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="h-10 flex-1 rounded-md border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)] px-3 text-sm"
          />
          <button
            onClick={handleSearch}
            className="h-10 rounded-md bg-[var(--flow-color-bg-brand)] px-4 text-sm font-medium text-white"
          >
            Search
          </button>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            updateFilter('status', e.target.value);
          }}
          className="h-10 rounded-md border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)] px-3 text-sm"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {noClientsAtAll && !isScopedMember && (
        <ClientEmptyState variant="no-clients" />
      )}
      {noClientsAtAll && isScopedMember && (
        <ClientEmptyState variant="no-assigned" />
      )}
      {noFilterResults && !noClientsAtAll && (
        <ClientEmptyState variant="no-results" onReset={() => router.push('/clients')} />
      )}
      {!noClientsAtAll && !noFilterResults && (
        <>
          <ClientTable clients={clients} sortBy={filters.sortBy ?? 'created_at'} sortOrder={filters.sortOrder ?? 'desc'} onSort={(col) => {
            const params = new URLSearchParams(searchParams.toString());
            const currentSort = params.get('sort');
            if (currentSort === col) {
              params.set('order', filters.sortOrder === 'asc' ? 'desc' : 'asc');
            } else {
              params.set('sort', col);
              params.set('order', 'asc');
            }
            params.delete('page');
            router.push(`/clients?${params.toString()}`);
          }} />
          <div className="flex items-center justify-between text-sm text-[var(--flow-color-text-secondary)]">
            <span>{total} client{total !== 1 ? 's' : ''}</span>
            <div className="flex gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="rounded-md border border-[var(--flow-color-border-default)] px-3 py-1 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="py-1">Page {page}</span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={!hasNextPage}
                className="rounded-md border border-[var(--flow-color-border-default)] px-3 py-1 disabled:opacity-50"
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
