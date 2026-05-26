export function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold font-mono">${value}</p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
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
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}
