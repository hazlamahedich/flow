'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createInvoiceAction, checkInvoiceDuplicatesAction } from '../actions';
import type { DuplicateWarning } from '@flow/types';

interface ClientOption {
  id: string;
  name: string;
  hourlyRateCents: number | null;
}

interface TimeEntryOption {
  id: string;
  date: string;
  durationMinutes: number;
  notes: string | null;
  projectName: string | null;
}

interface RetainerOption {
  id: string;
  type: string;
  monthlyFeeCents: number | null;
  notes: string | null;
}

interface CreateInvoicePageProps {
  clients: ClientOption[];
}

export function CreateInvoiceForm({ clients }: CreateInvoicePageProps) {
  const router = useRouter();
  const [clientId, setClientId] = useState('');
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<
    Array<{
      sourceType: 'time_entry' | 'fixed_service' | 'retainer';
      description: string;
      quantity: number;
      amountCents: number;
      timeEntryId?: string;
      retainerId?: string;
    }>
  >([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<DuplicateWarning[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addFixedServiceItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        sourceType: 'fixed_service',
        description: '',
        quantity: 1,
        amountCents: 0,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (
    index: number,
    field: string,
    value: string | number,
  ) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setWarnings([]);

    if (!clientId) {
      setErrors(['Please select a client.']);
      return;
    }

    if (lineItems.length === 0) {
      setErrors(['Add at least one line item.']);
      return;
    }

    if (!issueDate || !dueDate) {
      setErrors(['Issue date and due date are required.']);
      return;
    }

    if (dueDate < issueDate) {
      setErrors(['Due date must be on or after issue date.']);
      return;
    }

    const invalidItems = lineItems.filter(
      (li) => !li.description.trim() || li.quantity <= 0,
    );
    if (invalidItems.length > 0) {
      setErrors(['All line items must have a description and quantity > 0.']);
      return;
    }

    setSubmitting(true);

    try {
      const dedupResult = await checkInvoiceDuplicatesAction({
        clientId,
        issueDate,
        lineItems,
      });

      if (dedupResult.success && dedupResult.data.length > 0) {
        setWarnings(dedupResult.data);
      }

      const result = await createInvoiceAction({
        clientId,
        lineItems,
        issueDate,
        dueDate,
        notes: notes || undefined,
      });

      if (result.success) {
        router.push(`/invoices/${result.data.id}`);
        router.refresh();
      } else {
        setErrors([result.error.message]);
      }
    } catch {
      setErrors(['An unexpected error occurred.']);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.length > 0 && (
        <div className="rounded-md bg-destructive/10 p-3">
          {errors.map((err, i) => (
            <p key={i} className="text-sm text-destructive">
              {err}
            </p>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-md bg-yellow-50 p-3">
          <p className="text-sm font-medium text-yellow-800">
            Duplicate invoice warning
          </p>
          {warnings.map((w, i) => (
            <p key={i} className="text-sm text-yellow-700">
              {w.invoiceNumber}: similar invoice exists for this client
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div />
        <div>
          <label className="text-sm font-medium">Issue Date</label>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Line Items</h2>
          <button
            type="button"
            onClick={addFixedServiceItem}
            className="text-sm text-primary hover:underline"
          >
            + Add Fixed Service
          </button>
        </div>

        {lineItems.map((item, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border p-3 sm:grid-cols-5"
          >
            <input
              type="text"
              placeholder="Description"
              value={item.description}
              onChange={(e) =>
                updateLineItem(index, 'description', e.target.value)
              }
              className="rounded-md border bg-background px-2 py-1 text-sm sm:col-span-2"
            />
            <input
              type="number"
              placeholder="Qty"
              value={item.quantity || ''}
              onChange={(e) =>
                updateLineItem(
                  index,
                  'quantity',
                  parseFloat(e.target.value) || 0,
                )
              }
              className="rounded-md border bg-background px-2 py-1 text-sm"
              min="0.01"
              step="0.01"
            />
            <input
              type="number"
              placeholder="Amount ($)"
              value={item.amountCents ? item.amountCents / 100 : ''}
              onChange={(e) =>
                updateLineItem(
                  index,
                  'amountCents',
                  Math.round((parseFloat(e.target.value) || 0) * 100),
                )
              }
              className="rounded-md border bg-background px-2 py-1 text-sm"
              min="0"
              step="0.01"
            />
            <button
              type="button"
              onClick={() => removeLineItem(index)}
              className="text-xs text-destructive hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div>
        <label className="text-sm font-medium">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          rows={3}
          maxLength={5000}
        />
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <div className="text-sm text-muted-foreground">
          Total: $
          {(lineItems.reduce((s, li) => s + li.amountCents, 0) / 100).toFixed(
            2,
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </form>
  );
}
