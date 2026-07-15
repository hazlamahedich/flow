'use client';

interface InvoiceWarningBannerProps {
  onAcknowledge: (ack: boolean) => void;
  acknowledged: boolean;
}

export function InvoiceWarningBanner({
  onAcknowledge,
  acknowledged,
}: InvoiceWarningBannerProps) {
  return (
    <div
      role="alert"
      className="mb-4 rounded border border-amber-500/50 bg-amber-50 p-3 dark:bg-amber-950/20"
    >
      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
        This time entry has been included in an invoice. Editing it may affect
        billing accuracy.
      </p>
      <label className="mt-2 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => onAcknowledge(e.target.checked)}
          className="rounded"
        />
        I understand this entry is invoiced
      </label>
    </div>
  );
}
