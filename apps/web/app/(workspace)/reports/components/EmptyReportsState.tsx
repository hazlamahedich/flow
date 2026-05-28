import Link from 'next/link';

export function EmptyReportsState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <p className="text-sm text-muted-foreground">
        No reports yet — generate your first weekly report
      </p>
      <Link
        href="/reports/new"
        className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Generate Report
      </Link>
    </div>
  );
}
