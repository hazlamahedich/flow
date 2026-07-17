import { Suspense } from 'react';
import Link from 'next/link';
import { getWeeklyReportByIdAction } from './actions';
import { getReportVersions } from '@/lib/actions/reports/get-report-versions';
import { StatusBadge } from '../components/StatusBadge';
import { VersionBadge } from '../components/VersionBadge';
import { RegenerateButton } from '../components/RegenerateButton';
import { TimeSummarySection } from '../components/TimeSummarySection';
import {
  TaskLogSection,
  AgentActivitySection,
  InvoiceSummarySection,
} from '../components/ReportSections';
import { ReportDetailSkeleton } from '../components/ReportSkeleton';

async function ReportDetail({ reportId }: { reportId: string }) {
  const result = await getWeeklyReportByIdAction(reportId);

  if (!result.success) {
    return (
      <div className="space-y-6">
        <Link
          href="/reports"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to reports
        </Link>
        <p className="text-sm text-destructive">{result.error.message}</p>
      </div>
    );
  }

  const { report, sections, role } = result.data;

  const sectionMap = new Map(sections.map((s) => [s.sectionType, s]));

  const totalVersions = report.versionGroupId
    ? (await getReportVersions({ versionGroupId: report.versionGroupId }))
        .length || 1
    : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/reports"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to reports
          </Link>
          <h1
            data-testid="report-detail-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Weekly Report
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <VersionBadge
            version={report.version}
            versionGroupId={report.versionGroupId}
            totalVersions={totalVersions}
          />
          <StatusBadge status={report.status} />
          <RegenerateButton
            reportId={report.id}
            expectedVersion={report.version}
            role={role}
            status={report.status}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border p-4 space-y-2">
          <p className="text-sm text-muted-foreground">Period</p>
          <p className="font-medium">
            {report.periodStart} → {report.periodEnd}
          </p>
        </div>
        <div className="rounded-md border p-4 space-y-2">
          <p className="text-sm text-muted-foreground">Generated</p>
          <p className="font-medium">{report.generatedAt.split('T')[0]}</p>
        </div>
      </div>

      <div className="space-y-8">
        {(
          [
            'time_summary',
            'task_log',
            'agent_activity',
            'invoice_summary',
          ] as const
        ).map((type) => {
          const sec = sectionMap.get(type);
          if (!sec) return null;

          if (type === 'time_summary') {
            return (
              <TimeSummarySection
                key={sec.id}
                content={sec.content as { totalMinutes: number }}
              />
            );
          }
          if (type === 'task_log') {
            return (
              <TaskLogSection
                key={sec.id}
                content={
                  sec.content as {
                    projects?: Array<{
                      projectName: string;
                      entries: Array<{
                        date: string;
                        durationMinutes: number;
                        notes: string;
                      }>;
                    }>;
                  }
                }
              />
            );
          }
          if (type === 'agent_activity') {
            return (
              <AgentActivitySection
                key={sec.id}
                content={
                  sec.content as {
                    runs?: Array<{
                      actionType: string;
                      status: string;
                      count: number;
                    }>;
                  }
                }
              />
            );
          }
          if (type === 'invoice_summary') {
            return (
              <InvoiceSummarySection
                key={sec.id}
                content={
                  sec.content as {
                    totalCents: number;
                    amountPaidCents: number;
                    invoiceCount: number;
                  }
                }
              />
            );
          }
        })}
      </div>
    </div>
  );
}

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const paramsPromise = params;

  return (
    <Suspense fallback={<ReportDetailSkeleton />}>
      <ReportDetailLoader params={paramsPromise} />
    </Suspense>
  );
}

async function ReportDetailLoader({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  return <ReportDetail reportId={reportId} />;
}
