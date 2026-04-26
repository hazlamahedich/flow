'use client';

import { useState } from 'react';
import type { Client } from '@flow/types';
import { ClientEditForm } from './client-edit-form';

interface ClientDetailsProps {
  client: Client;
  role: string;
}

export function ClientDetails({ client, role }: ClientDetailsProps) {
  const [editing, setEditing] = useState(false);
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  if (editing) {
    return <ClientEditForm client={client} onCancel={() => setEditing(false)} />;
  }

  return (
    <div className="space-y-4">
      {isOwnerOrAdmin && (
        <div className="flex justify-end">
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm font-medium"
          >
            Edit
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 rounded-lg border border-[var(--flow-color-border-default)] p-6">
        <DetailField label="Name" value={client.name} />
        <DetailField label="Company" value={client.companyName} />
        <DetailField label="Email" value={client.email} />
        <DetailField label="Phone" value={client.phone} />
        <DetailField label="Billing Email" value={client.billingEmail} />
        <DetailField label="Hourly Rate" value={
          client.hourlyRateCents != null
            ? `$${(client.hourlyRateCents / 100).toFixed(2)}`
            : null
        } />
        <div className="col-span-2">
          <DetailField label="Address" value={client.address} />
        </div>
        <div className="col-span-2">
          <DetailField label="Notes" value={client.notes} />
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-[var(--flow-color-text-secondary)]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--flow-color-text-primary)]">{value ?? '—'}</dd>
    </div>
  );
}
