'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { voidInvoiceAction } from '../actions';

interface VoidInvoiceButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  timeEntryCount: number;
  amountPaidCents: number;
}

export function VoidInvoiceButton({ invoiceId, invoiceNumber, timeEntryCount, amountPaidCents }: VoidInvoiceButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

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
      setTimeout(() => textareaRef.current?.focus(), 50);
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  async function handleVoid() {
    setError('');
    if (!reason.trim()) {
      setError('Reason is required (1–500 characters).');
      return;
    }
    setLoading(true);
    const result = await voidInvoiceAction({ invoiceId, reason: reason.trim() });
    setLoading(false);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    setOpen(false);
    triggerRef.current?.focus();
    router.refresh();
  }

  const paidDollars = (amountPaidCents / 100).toFixed(2);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-destructive/5"
      >
        Void Invoice
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-title"
          onKeyDown={handleKeyDown}
        >
          <div ref={dialogRef} className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg space-y-4">
            <h2 id="void-title" className="text-lg font-semibold">Void Invoice {invoiceNumber}</h2>

            {timeEntryCount > 0 && (
              <div className="rounded-md bg-muted p-3 text-sm">
                This invoice contains <strong>{timeEntryCount} time entries</strong>. These will become available for re-invoicing.
              </div>
            )}

            {amountPaidCents > 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                Payments already recorded: <strong>${paidDollars}</strong>. These payments remain on this voided invoice. You must manually account for them on a replacement invoice.
              </div>
            )}

            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              Voiding permanently cancels this invoice. It cannot be reactivated or edited afterward.
            </div>

            <div className="space-y-1">
              <label htmlFor="void-reason" className="text-sm font-medium">Reason for voiding (required for audit log)</label>
              <textarea
                ref={textareaRef}
                id="void-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                aria-describedby="void-error void-counter void-warning"
              />
              <p id="void-counter" className="text-xs text-muted-foreground text-right">{reason.length}/500</p>
            </div>

            <p id="void-error" className={`text-sm text-destructive min-h-[1.25rem] ${error ? '' : 'invisible'}`} role={error ? 'alert' : undefined}>
              {error || '\u00A0'}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
              <button
                type="button"
                onClick={handleVoid}
                disabled={loading}
                className="rounded-md border border-destructive px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                {loading ? 'Voiding\u2026' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
