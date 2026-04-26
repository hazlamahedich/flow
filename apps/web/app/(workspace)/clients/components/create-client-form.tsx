'use client';

import { useActionState } from 'react';
import { createWorkspaceClient } from '../actions/create-client';
import type { ActionResult, Client } from '@flow/types';

interface CreateClientFormProps {
  activeCount: number;
  onSuccess: () => void;
}

export function CreateClientForm({ activeCount: _activeCount, onSuccess }: CreateClientFormProps) {
  const [state, submitAction, isPending] = useActionState(
    async (_prev: ActionResult<Client> | null, formData: FormData) => {
      const hourlyRate = formData.get('hourlyRateCents');
      const result = await createWorkspaceClient({
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? '') || null,
        phone: String(formData.get('phone') ?? '') || null,
        companyName: String(formData.get('companyName') ?? '') || null,
        address: String(formData.get('address') ?? '') || null,
        notes: String(formData.get('notes') ?? '') || null,
        billingEmail: String(formData.get('billingEmail') ?? '') || null,
        hourlyRateCents: hourlyRate && !isNaN(Number(hourlyRate)) ? Math.round(Number(hourlyRate) * 100) : null,
      });
      if (result.success) onSuccess();
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
      {state?.success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          Client created successfully!
        </div>
      )}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={200}
          className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
          placeholder="Client contact name"
        />
      </div>

      <div>
        <label htmlFor="companyName" className="mb-1 block text-sm font-medium">
          Company
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          maxLength={200}
          className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
          />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="text"
            maxLength={50}
            className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="billingEmail" className="mb-1 block text-sm font-medium">
          Billing Email
        </label>
        <input
          id="billingEmail"
          name="billingEmail"
          type="email"
          className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
        />
      </div>

      <div>
        <label htmlFor="hourlyRateCents" className="mb-1 block text-sm font-medium">
          Hourly Rate ($)
        </label>
        <input
          id="hourlyRateCents"
          name="hourlyRateCents"
          type="number"
          step="0.01"
          min="0"
          className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
          placeholder="0.00"
        />
      </div>

      <div>
        <label htmlFor="address" className="mb-1 block text-sm font-medium">
          Address
        </label>
        <input
          id="address"
          name="address"
          type="text"
          maxLength={500}
          className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
        />
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          maxLength={5000}
          rows={3}
          className="w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-[var(--flow-color-bg-brand)] py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Creating...' : 'Create Client'}
      </button>
    </form>
  );
}
