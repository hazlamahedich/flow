export function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold font-mono">${value}</p>
    </div>
  );
}

export function StatusBadge({
  status,
  creditBalanceCents,
  amountPaidCents,
  voidReason,
}: {
  status: string;
  creditBalanceCents?: number;
  amountPaidCents?: number;
  voidReason?: string | null;
}) {
  const label = status.replaceAll('_', ' ');
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-indigo-100 text-indigo-700',
    partially_paid: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    voided: 'bg-gray-100 text-gray-400 line-through',
  };

  const base = styles[status] ?? 'bg-gray-100 text-gray-600';
  const paidDollars = amountPaidCents != null ? (amountPaidCents / 100).toFixed(2) : null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${base}`}
      aria-label={`Status: ${label}`}
      title={status === 'voided' && voidReason ? `Void reason: ${voidReason}` : undefined}
    >
      {status === 'voided' && paidDollars !== null ? `Voided \u00B7 $${paidDollars} paid` : label}
      {creditBalanceCents != null && creditBalanceCents > 0 && status !== 'paid' && (
        <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">
          Credit Applied \u00B7 ${(creditBalanceCents / 100).toFixed(2)}
        </span>
      )}
    </span>
  );
}
