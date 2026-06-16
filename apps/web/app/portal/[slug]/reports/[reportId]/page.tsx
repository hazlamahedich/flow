import { validatePortalSlug } from '@/lib/actions/portal';
import { createPortalClient } from '@flow/auth/server/portal-client';
import { PORTAL_SESSION_MAX_AGE_SECONDS } from '@/lib/actions/portal/constants';
import { ApproveReportButton } from '@/app/portal/components/ApproveReportButton';
import { RequestChangesForm } from '@/app/portal/components/RequestChangesForm';

interface ReportSection {
  title: string;
  content: unknown;
  sectionType: string;
  sortOrder: number;
}

/**
 * Portal report detail page.
 *
 * Story 9.2 — AC4 (FR53). Server Component reading the report + sections.
 * Approve / request-changes are Client Components using useActionState.
 */
export default async function PortalReportDetailPage({
  params,
}: {
  params: Promise<{ slug: string; reportId: string }>;
}) {
  const { slug, reportId } = await params;
  const session = await validatePortalSlug(slug);
  if (!session) return null;

  const client = await createPortalClient(session, PORTAL_SESSION_MAX_AGE_SECONDS);

  const { data: report, error } = await client
    .from('weekly_reports')
    .select('id, period_start, period_end, status, generated_at, client_feedback, feedback_at')
    .eq('id', reportId)
    .eq('workspace_id', session.workspaceId)
    .eq('client_id', session.clientId)
    .maybeSingle();

  if (error || !report) {
    return (
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <p className="text-sm text-[var(--flow-text-muted)]">Report not found.</p>
      </div>
    );
  }

  const r = report as Record<string, unknown>;
  const status = String(r.status);
  const isPending = status === 'sent' || status === 'viewed';

  const { data: sections, error: sectionsError } = await client
    .from('weekly_report_sections')
    .select('title, content, section_type, sort_order')
    .eq('report_id', reportId)
    .eq('workspace_id', session.workspaceId)
    .order('sort_order', { ascending: true });

  if (sectionsError) {
    return (
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <p className="text-sm text-[var(--flow-text-muted)]">Unable to load report sections.</p>
      </div>
    );
  }

  const typedSections: ReportSection[] = (sections ?? []).map((s) => ({
    title: String(s.title),
    content: s.content,
    sectionType: String(s.section_type),
    sortOrder: Number(s.sort_order),
  }));

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--flow-text-primary)]">
          Weekly Report
        </h1>
        <p className="text-sm text-[var(--flow-text-muted)]">
          {formatDate(String(r.period_start))} — {formatDate(String(r.period_end))} &middot;{' '}
          <span className="capitalize">{status.replaceAll('_', ' ')}</span>
        </p>
      </div>

      {typedSections.map((s) => (
        <section key={`${s.sectionType}-${s.sortOrder}`} className="space-y-1">
          <h2 className="text-lg font-medium text-[var(--flow-text-primary)]">{s.title}</h2>
          <div className="text-sm text-[var(--flow-text-secondary)] whitespace-pre-wrap">
            {renderSectionContent(s.content)}
          </div>
        </section>
      ))}

      {isPending && (
        <div className="space-y-4 pt-4 border-t border-[var(--flow-border-default)]">
          <ApproveReportButton portalCtx={session} reportId={reportId} />
          <details>
            <summary className="cursor-pointer text-sm text-[var(--flow-text-muted)]">
              Request changes instead
            </summary>
            <div className="mt-3">
              <RequestChangesForm portalCtx={session} reportId={reportId} />
            </div>
          </details>
        </div>
      )}

      {typeof r.client_feedback === 'string' && r.client_feedback.length > 0 && (
        <div className="p-4 rounded-lg border border-[var(--flow-border-default)] bg-[var(--flow-bg-subtle)]">
          <h2 className="text-sm font-medium text-[var(--flow-text-muted)]">Your feedback</h2>
          <p className="mt-1 text-sm text-[var(--flow-text-secondary)]">{String(r.client_feedback)}</p>
        </div>
      )}
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderSectionContent(content: unknown): string {
  if (content === null || content === undefined) return '';
  if (typeof content === 'object') return JSON.stringify(content, null, 2);
  return String(content);
}
