'use client';

import dynamic from 'next/dynamic';

export const RecordPaymentButton = dynamic(
  () => import('./record-payment-button').then((m) => m.RecordPaymentButton),
  { ssr: false },
);

export const VoidInvoiceButton = dynamic(
  () => import('./void-invoice-button').then((m) => m.VoidInvoiceButton),
  { ssr: false },
);

export const IssueCreditNoteButton = dynamic(
  () =>
    import('./issue-credit-note-button').then((m) => m.IssueCreditNoteButton),
  { ssr: false },
);
