'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { recordPaymentAction } from '../actions';
import { formatCentsToDollar, parseDollarToCents } from '@flow/shared';
import type { PaymentMethod } from '@flow/types';
import { OverpaymentConfirmation } from './overpayment-confirmation';

interface RecordPaymentModalProps {
  invoiceId: string;
  invoiceNumber: string;
  totalCents: number;
  amountPaidCents: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'manual_check', label: 'Manual Check' },
  { value: 'manual_bank_transfer', label: 'Manual Bank Transfer' },
  { value: 'manual_cash', label: 'Manual Cash' },
  { value: 'manual_other', label: 'Manual Other' },
];

export function RecordPaymentModal({
  invoiceId,
  invoiceNumber,
  totalCents,
  amountPaidCents,
  onClose,
}: RecordPaymentModalProps) {
  const router = useRouter();
  const outstanding = totalCents - amountPaidCents;
  const idempotencyRef = useRef(crypto.randomUUID());

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [amountStr, setAmountStr] = useState(
    formatCentsToDollar(Math.max(outstanding, 0)),
  );
  const [paymentDate, setPaymentDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [method, setMethod] = useState<PaymentMethod>('manual_check');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState<{
    excessCents: number;
    creditCents: number;
  } | null>(null);

  const parseAmount = useCallback((val: string): number | null => {
    if (!val || val === '.') return null;
    return parseDollarToCents(val);
  }, []);

  const todayStr = (() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  })();

  async function handleSubmit(confirmOverpayment = false) {
    const parsedCents = parseAmount(amountStr);
    if (parsedCents == null || parsedCents <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    setError('');
    setSubmitting(true);

    const result = await recordPaymentAction({
      invoiceId,
      amountCents: parsedCents,
      paymentDate,
      paymentMethod: method,
      notes: notes || undefined,
      idempotencyKey: idempotencyRef.current,
      confirmOverpayment,
    });

    setSubmitting(false);

    if (result.success) {
      alert(
        `Payment of ${formatCentsToDollar(parsedCents)} recorded successfully.`,
      );
      router.refresh();
      onClose();
    } else {
      const details = (result.error?.details ?? {}) as Record<string, unknown>;
      const overpayment = details.overpayment as
        | {
            type: string;
            excessAmountCents: number;
            creditBalanceCents: number;
          }
        | undefined;

      if (overpayment && !confirmOverpayment) {
        setWarning({
          excessCents: overpayment.excessAmountCents,
          creditCents: overpayment.creditBalanceCents,
        });
        return;
      }

      setError(result.error?.message ?? 'Failed to record payment.');
    }
  }

  function formatInput(raw: string): string {
    const cleaned = raw.replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('');
    if (parts[1] && parts[1].length > 2)
      return parts[0] + '.' + parts[1].slice(0, 2);
    return cleaned;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-payment-title"
    >
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="record-payment-title" className="text-lg font-semibold">
            Record Payment — {invoiceNumber}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {warning && (
          <OverpaymentConfirmation
            excessCents={warning.excessCents}
            displayAmount={formatCentsToDollar(parseAmount(amountStr) ?? 0)}
            onConfirm={() => handleSubmit(true)}
            onCancel={() => setWarning(null)}
          />
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="amount" className="text-sm font-medium">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <input
                id="amount"
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(formatInput(e.target.value))}
                disabled={!!warning}
                className="w-full rounded-md border bg-background pl-6 pr-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-ring"
                aria-describedby="amount-error"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Outstanding: ${formatCentsToDollar(outstanding)}
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="payment-date" className="text-sm font-medium">
              Payment Date *
            </label>
            <input
              id="payment-date"
              type="date"
              value={paymentDate}
              max={todayStr}
              onChange={(e) => setPaymentDate(e.target.value)}
              disabled={!!warning}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-ring"
            />
            <p id="date-error" className="text-sm text-destructive"></p>
          </div>

          <div className="space-y-1">
            <label htmlFor="method" className="text-sm font-medium">
              Payment Method *
            </label>
            <select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              disabled={!!warning}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-ring"
            >
              {paymentMethods.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
              disabled={!!warning}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-ring"
              aria-describedby="notes-hint"
            />
            <p id="notes-hint" className="text-xs text-muted-foreground">
              {notes.length}/1000
            </p>
          </div>

          {error && (
            <p id="amount-error" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting || !!warning}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
