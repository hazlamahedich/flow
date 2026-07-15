import {
  requireTenantContext,
  createServerClient,
  getUsageAnalytics,
} from '@flow/db';
import { cookies as nextCookies } from 'next/headers';

const ALLOWED_ROLES = new Set(['owner', 'admin']);
const VALID_PERIODS = new Set(['7', '30', '90']);

function PeriodSelector({ current }: { current: number }) {
  const options = [
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
  ];

  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <a
          key={opt.value}
          href={`?period=${opt.value}`}
          className={`rounded-md px-3 py-1.5 text-sm ${
            current === opt.value
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {opt.label}
        </a>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">
        {value}
        {suffix ? (
          <span className="text-base font-normal text-gray-500 ml-1">
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  );
}

interface AnalyticsPageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function AnalyticsPage({
  searchParams,
}: AnalyticsPageProps) {
  const resolved = await searchParams;
  const rawPeriod = resolved.period ?? '30';
  const periodDays = VALID_PERIODS.has(rawPeriod) ? Number(rawPeriod) : 30;

  const cookieStore = await nextCookies();
  const supabase = createServerClient({
    getAll() {
      return cookieStore
        .getAll()
        .map((c) => ({ name: c.name, value: c.value }));
    },
    set(name: string, value: string, options?: Record<string, unknown>) {
      try {
        cookieStore.set(name, value, { ...options, path: '/' });
      } catch {
        // Cookie setting can fail in read-only contexts (Server Components)
      }
    },
  });
  const { workspaceId, role } = await requireTenantContext(supabase);

  if (!ALLOWED_ROLES.has(role)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900">
            Access Restricted
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Contact your workspace owner to view analytics.
          </p>
        </div>
      </div>
    );
  }

  const analytics = await getUsageAnalytics(supabase, workspaceId, periodDays);

  const completionPct = (analytics.agentCompletionRate * 100).toFixed(1);
  const approvalPct = (analytics.agentApprovalRate * 100).toFixed(1);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Usage Analytics</h1>
        <PeriodSelector current={periodDays} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Completion Rate" value={`${completionPct}%`} />
        <MetricCard label="Approval Rate" value={`${approvalPct}%`} />
        <MetricCard label="Tasks Completed" value={analytics.tasksCompleted} />
        <MetricCard
          label="Time Saved"
          value={analytics.timeSavedMinutes}
          suffix="min"
        />
      </div>

      {Object.keys(analytics.trustDistribution).length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-500 mb-3">
            Trust Level Distribution
          </h2>
          <div className="space-y-2">
            {Object.entries(analytics.trustDistribution).map(
              ([level, count]) => (
                <div
                  key={level}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-700 capitalize">
                    {level.replace('-', ' ')}
                  </span>
                  <span className="font-medium text-gray-900">{count}</span>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
