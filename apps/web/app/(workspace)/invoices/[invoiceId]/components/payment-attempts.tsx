'use client';

import { useState, useCallback } from 'react';
import type { PaymentAttempt } from '@flow/db';
import { formatCentsToDollar, isRetryableDeclineCode } from '@flow/shared';
import { AlertTriangle, Copy, CheckCircle2 } from 'lucide-react';
import { RecordPaymentModal } from './record-payment-modal';

interface PaymentAttemptsSectionProps {
  invoiceId: string;
  invoiceNumber: string;
  totalCents: number;
  amountPaidCents: number;
  paymentUrl: string | null;
  attempts: PaymentAttempt[];
}

export function PaymentAttemptsSection({
  invoiceId,
  invoiceNumber,
  totalCents,
  amountPaidCents,
  paymentUrl,
  attempts,
}: PaymentAttemptsSectionProps) {
  const failedStripeAttempts = attempts.filter(
    (a) => a.attemptType === 'stripe_checkout' && a.status === 'failed',
  );

  if (failedStripeAttempts.length === 0) return null;

  return (
    <div className="rounded-md border">
      <div className="border-b bg-muted/50 px-4 py-3">
        <h2 className="text-sm font-medium">Payment Attempts</h2>
      </div>
      <div className="divide-y">
        {failedStripeAttempts.map((attempt) => (
          <PaymentAttemptRow
            key={attempt.id}
            attempt={attempt}
            paymentUrl={paymentUrl}
            invoiceId={invoiceId}
            invoiceNumber={invoiceNumber}
            totalCents={totalCents}
            amountPaidCents={amountPaidCents}
          />
        ))}
      </div>
    </div>
  );
}

function PaymentAttemptRow({
  attempt,
  paymentUrl,
  invoiceId,
  invoiceNumber,
  totalCents,
  amountPaidCents,
}: {
  attempt: PaymentAttempt;
  paymentUrl: string | null;
  invoiceId: string;
  invoiceNumber: string;
  totalCents: number;
  amountPaidCents: number;
}) {
  const [copied, setCopied] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const retryable = isRetryableDeclineCode(attempt.errorCode ?? undefined);

  const handleCopyLink = useCallback(() => {
    if (!paymentUrl) return;
    void navigator.clipboard.writeText(paymentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard API may reject (permissions, not focused) — silently ignore
    });
  }, [paymentUrl]);

  const attemptDate = new Date(attempt.createdAt).toLocaleString();

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5 shrink-0">
        <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-amber-700">
            Failed payment attempt
          </span>
          <span className="text-xs text-muted-foreground">{attemptDate}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Amount:{" "}
          <span className="font-mono font-medium text-foreground">
            {formatCentsToDollar(attempt.amountCents)}
          </span>
        </p>
        <p className="text-sm text-amber-700">{attempt.errorMessage}</p>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleCopyLink}
            disabled={!retryable || !paymentUrl}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                {retryable ? 'Copy Payment Link' : 'Payment Link (Not Retryable)'}
              </>
            )}
          </button>
          <button
            onClick={() => setShowRecordPayment(true)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Record Manual Payment
          </button>
        </div>
      </div>

      {showRecordPayment && (
        <RecordPaymentModal
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          totalCents={totalCents}
          amountPaidCents={amountPaidCents}
          onClose={() => setShowRecordPayment(false)}
        />
      )}
    </div>
  );
}
