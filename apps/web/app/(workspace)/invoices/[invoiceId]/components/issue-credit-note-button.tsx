'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { issueCreditNoteAction } from '../actions';

interface IssueCreditNoteButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  maxCreditCents: number;
}

function dollarsToCents(dollars: string): number {
  const parts = dollars.split('.');
  const whole = parseInt(parts[0] || '0', 10) || 0;
  const cents = parts[1]
    ? parseInt(parts[1].padEnd(2, '0').slice(0, 2), 10)
    : 0;
  return whole * 100 + cents;
}

function centsToDollars(cents: number): string {
  const whole = Math.floor(cents / 100);
  const frac = cents % 100;
  return `${whole}.${frac.toString().padStart(2, '0')}`;
}

export function IssueCreditNoteButton({
  invoiceId,
  invoiceNumber,
  maxCreditCents,
}: IssueCreditNoteButtonProps) {
  const [open, setOpen] = useState(false);
  const [amountDollars, setAmountDollars] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const maxDollars = centsToDollars(maxCreditCents);
  const amountCents = dollarsToCents(amountDollars);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, textarea, input, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => amountRef.current?.focus(), 50);
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  async function handleIssue() {
    setError('');
    if (amountCents <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (amountCents > maxCreditCents) {
      setError(`Credit amount cannot exceed $${maxDollars}.`);
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required (1–500 characters).');
      return;
    }
    setLoading(true);
    const result = await issueCreditNoteAction({
      invoiceId,
      amountCents,
      reason: reason.trim(),
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    setOpen(false);
    triggerRef.current?.focus();
    router.refresh();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
      >
        Issue Credit Note
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="credit-title"
          onKeyDown={handleKeyDown}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg space-y-4"
          >
            <h2 id="credit-title" className="text-lg font-semibold">
              Issue Credit Note — {invoiceNumber}
            </h2>

            <div className="space-y-1">
              <label htmlFor="credit-amount" className="text-sm font-medium">
                Credit Amount (max $<span>{maxDollars}</span>)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <input
                  ref={amountRef}
                  id="credit-amount"
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]{0,2}"
                  value={amountDollars}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*\.?\d{0,2}$/.test(val) || val === '')
                      setAmountDollars(val);
                  }}
                  placeholder="0.00"
                  className="w-full rounded-md border bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Credit amount in dollars"
                  aria-describedby="credit-error credit-hint"
                />
              </div>
              <p id="credit-hint" className="text-xs text-muted-foreground">
                Maximum credit: ${maxDollars}
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="credit-reason" className="text-sm font-medium">
                Reason
              </label>
              <textarea
                id="credit-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                aria-describedby="credit-error credit-counter"
              />
              <p
                id="credit-counter"
                className="text-xs text-muted-foreground text-right"
              >
                {reason.length}/500
              </p>
            </div>

            <p
              id="credit-error"
              className={`text-sm text-destructive min-h-[1.25rem] ${error ? '' : 'invisible'}`}
              role={error ? 'alert' : undefined}
            >
              {error || '\u00A0'}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIssue}
                disabled={loading}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? 'Issuing\u2026' : 'Issue Credit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
