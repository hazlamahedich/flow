'use client';

import { useState } from 'react';
import { RecordPaymentModal } from './record-payment-modal';

interface RecordPaymentButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  totalCents: number;
  amountPaidCents: number;
}

export function RecordPaymentButton({
  invoiceId,
  invoiceNumber,
  totalCents,
  amountPaidCents,
}: RecordPaymentButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Record Payment
      </button>
      {open && (
        <RecordPaymentModal
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          totalCents={totalCents}
          amountPaidCents={amountPaidCents}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
