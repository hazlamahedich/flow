import { validatePortalSlug } from '@/lib/actions/portal';
import { createPortalClient } from '@flow/auth/server/portal-client';
import { PORTAL_SESSION_MAX_AGE_SECONDS } from '@/lib/actions/portal/constants';

/**
 * Portal reports list page.
 *
 * Story 9.2 — AC4 (FR53). Server Component — reads reports via
 * createPortalClient (RLS-gated, read-only).
 */
export default async function PortalReportsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await validatePortalSlug(slug);
  if (!session) return null;

  const client = await createPortalClient(session, PORTAL_SESSION_MAX_AGE_SECONDS);
  const { data: reports, error } = await client
    .from('weekly_reports')
    .select('id, period_start, period_end, status, generated_at')
    .eq('workspace_id', session.workspaceId)
    .eq('client_id', session.clientId)
    .order('generated_at', { ascending: false });

  if (error) {
    return (
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <p className="text-sm text-[var(--flow-text-muted)]">Unable to load reports at this time.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--flow-text-primary)]">Reports</h1>
      {(!reports || reports.length === 0) ? (
        <p className="text-sm text-[var(--flow-text-muted)]">No reports yet.</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => {
            const status = String(r.status);
            const periodStart = formatDate(String(r.period_start));
            const periodEnd = formatDate(String(r.period_end));
            return (
              <li key={String(r.id)}>
                <a
                  href={`/portal/${slug}/reports/${String(r.id)}`}
                  className="block p-4 rounded-lg border border-[var(--flow-border-default)] hover:border-[var(--portal-accent)] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--flow-text-primary)]">
                      {periodStart} — {periodEnd}
                    </span>
                    <span className="text-sm capitalize text-[var(--flow-text-muted)]">{status.replaceAll('_', ' ')}</span>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
