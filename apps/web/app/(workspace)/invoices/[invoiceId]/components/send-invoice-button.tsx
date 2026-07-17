'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendInvoiceAction, resendInvoiceAction } from '../actions';

interface SendInvoiceButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  status: string;
  paymentUrl: string | null;
}

export function SendInvoiceButtons({
  invoiceId,
  invoiceNumber,
  clientName,
  clientEmail,
  status,
  paymentUrl,
}: SendInvoiceButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const isDraft = status === 'draft';
  const canResend = status === 'sent' || status === 'viewed';

  async function handleSend() {
    setSending(true);
    setError('');
    const result = await sendInvoiceAction({ invoiceId });
    setSending(false);
    if (result.success) {
      setShowConfirm(false);
      router.refresh();
    } else {
      setError(result.error?.message ?? 'Failed to send invoice.');
    }
  }

  async function handleResend() {
    setSending(true);
    setError('');
    const result = await resendInvoiceAction({ invoiceId });
    setSending(false);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error?.message ?? 'Failed to resend invoice.');
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {isDraft && (
          <>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={sending || !clientEmail}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send Invoice'}
            </button>
          </>
        )}
        {canResend && (
          <>
            <button
              onClick={handleResend}
              disabled={sending}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Resend Email'}
            </button>
            {paymentUrl && (
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(paymentUrl);
                    setError('');
                  } catch {
                    setError('Failed to copy link — please copy manually.');
                  }
                }}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Copy Payment Link
              </button>
            )}
          </>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg space-y-4">
            <h2 className="text-lg font-semibold">Send Invoice</h2>
            <p className="text-sm text-muted-foreground">
              Send invoice <strong>{invoiceNumber}</strong> to{' '}
              <strong>{clientName}</strong> at{' '}
              <strong>{clientEmail ?? 'no email'}</strong>?
            </p>
            <p className="text-xs text-muted-foreground">
              Payment link will be generated and emailed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !clientEmail}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
