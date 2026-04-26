'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { updateWorkspaceClient } from '../../actions/update-client';
import type { Client, ActionResult } from '@flow/types';

interface ClientEditFormProps {
  client: Client;
  onCancel: () => void;
}

export function ClientEditForm({ client, onCancel }: ClientEditFormProps) {
  const router = useRouter();
  const [state, submitAction, isPending] = useActionState(
    async (_prev: ActionResult<Client> | null, formData: FormData) => {
      const hourlyRate = formData.get('hourlyRateCents');
      const result = await updateWorkspaceClient({
        clientId: client.id,
        name: (formData.get('name') as string | null) ?? '',
        email: ((formData.get('email') as string | null) ?? '') || null,
        phone: ((formData.get('phone') as string | null) ?? '') || null,
        companyName: ((formData.get('companyName') as string | null) ?? '') || null,
        address: ((formData.get('address') as string | null) ?? '') || null,
        notes: ((formData.get('notes') as string | null) ?? '') || null,
        billingEmail: ((formData.get('billingEmail') as string | null) ?? '') || null,
        hourlyRateCents: hourlyRate && !isNaN(Number(hourlyRate)) ? Math.round(Number(hourlyRate) * 100) : null,
      });
      if (result.success) {
        router.refresh();
      }
      return result;
    },
    null,
  );

  return (
    <form action={submitAction} className="space-y-4">
      {state && !state.success && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {state.error.message}
        </div>
      )}
      <div className="rounded-lg border border-[var(--flow-color-border-default)] p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="edit-name" className="mb-1 block text-sm font-medium">Name *</label>
            <input
              id="edit-name"
              name="name"
              type="text"
              required
              maxLength={200}
              defaultValue={client.name}
              className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="edit-company" className="mb-1 block text-sm font-medium">Company</label>
            <input
              id="edit-company"
              name="companyName"
              type="text"
              maxLength={200}
              defaultValue={client.companyName ?? ''}
              className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="edit-email" className="mb-1 block text-sm font-medium">Email</label>
            <input
              id="edit-email"
              name="email"
              type="email"
              defaultValue={client.email ?? ''}
              className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="edit-phone" className="mb-1 block text-sm font-medium">Phone</label>
            <input
              id="edit-phone"
              name="phone"
              type="text"
              maxLength={50}
              defaultValue={client.phone ?? ''}
              className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="edit-billing" className="mb-1 block text-sm font-medium">Billing Email</label>
            <input
              id="edit-billing"
              name="billingEmail"
              type="email"
              defaultValue={client.billingEmail ?? ''}
              className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="edit-rate" className="mb-1 block text-sm font-medium">Hourly Rate ($)</label>
            <input
              id="edit-rate"
              name="hourlyRateCents"
              type="number"
              step="0.01"
              min="0"
              defaultValue={client.hourlyRateCents != null ? (client.hourlyRateCents / 100).toFixed(2) : ''}
              className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="edit-address" className="mb-1 block text-sm font-medium">Address</label>
            <input
              id="edit-address"
              name="address"
              type="text"
              maxLength={500}
              defaultValue={client.address ?? ''}
              className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="edit-notes" className="mb-1 block text-sm font-medium">Notes</label>
            <textarea
              id="edit-notes"
              name="notes"
              maxLength={5000}
              rows={3}
              defaultValue={client.notes ?? ''}
              className="w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[var(--flow-color-bg-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
