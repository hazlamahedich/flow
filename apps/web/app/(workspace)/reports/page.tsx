import { Suspense } from 'react';
import Link from 'next/link';
import { getWeeklyReportsAction } from './actions';
import { ReportListSkeleton } from './components/ReportSkeleton';
import { EmptyReportsState } from './components/EmptyReportsState';
import { StatusBadge } from './components/StatusBadge';

async function ReportList({
  page,
  clientId,
}: {
  page: number;
  clientId?: string | undefined;
}) {
  const result = await getWeeklyReportsAction(page, clientId);

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        </div>
        <p className="text-sm text-muted-foreground">Unable to load reports.</p>
      </div>
    );
  }

  const { items, total, hasNextPage } = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <Link
          href="/reports/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Generate Report
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyReportsState />
      ) : (
        <>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Client</th>
                  <th className="px-4 py-3 text-left font-medium">Period</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Generated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((report) => (
                  <tr
                    key={report.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/reports/${report.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {report.clientName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {report.periodStart} → {report.periodEnd}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(report.generatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {total} report{total !== 1 ? 's' : ''} total
            </p>
            {hasNextPage && (
              <Link
                href={`/reports?page=${page + 1}`}
                className="text-sm text-primary hover:underline"
              >
                Next →
              </Link>
            )}
            {page > 1 && (
              <Link
                href={`/reports?page=${page - 1}`}
                className="text-sm text-primary hover:underline"
              >
                ← Previous
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; clientId?: string }>;
}) {
  const paramsPromise = searchParams;

  return (
    <Suspense fallback={<ReportListSkeleton />}>
      <ReportListLoader params={paramsPromise} />
    </Suspense>
  );
}

async function ReportListLoader({
  params,
}: {
  params: Promise<{ page?: string; clientId?: string }>;
}) {
  const paramsResolved = await params;
  const page = Math.max(Number(paramsResolved.page) || 1, 1);
  return <ReportList page={page} clientId={paramsResolved.clientId ?? undefined} />;
}
