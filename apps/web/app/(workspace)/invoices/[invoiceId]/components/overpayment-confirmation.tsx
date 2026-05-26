interface OverpaymentConfirmationProps {
  excessCents: number;
  displayAmount: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function OverpaymentConfirmation({
  excessCents,
  displayAmount,
  onConfirm,
  onCancel,
}: OverpaymentConfirmationProps) {
  return (
    <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
      <p className="text-sm text-yellow-800">
        Payment of {displayAmount} exceeds balance by{' '}
        ${excessCents}. Excess will be recorded as client credit.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={onConfirm}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Confirm
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
