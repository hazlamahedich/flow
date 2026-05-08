import { 
  getClientById, 
  getActiveRetainerForClient, 
  getRetainerUtilization, 
  listRetainersForClient,
  getClientEngagementTimeline 
} from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import { createSearchParamsCache, parseAsString } from 'nuqs/server';
import { Suspense } from 'react';
import { ClientHeader } from './components/client-header';
import { ClientDetails } from './components/client-details';
import { RetainerPanel } from './components/retainer-panel';
import { RetainerScopeBanner } from './components/retainer-scope-banner';
import { TeamAccessPanel } from './components/team-access-panel';
import { InboxConnectionCard } from './components/inbox-connection-card';
import { ClientTimeline } from './components/ClientTimeline';
import { TimelineSkeleton } from './components/TimelineSkeleton';
import { TimelineErrorBoundary } from './components/TimelineErrorBoundary';
import { WizardToast } from './components/wizard-toast';
import type { Client, UtilizationState } from '@flow/types';

export const timelineSearchParamsCache = createSearchParamsCache({
  type: parseAsString.withDefault('all'),
  range: parseAsString.withDefault('90d'),
  cursor: parseAsString,
});

function deriveUtilizationState(
  type: string,
  monthlyHoursThreshold: string | null,
  packageHours: string | null,
  utilization: { totalMinutes: number; allocatedMinutes: number; utilizationPercent: number } | null,
): UtilizationState | null {
  if (!utilization) return null;

  if (type === 'hourly_rate') {
    return { type: 'informational', hoursTracked: utilization.totalMinutes };
  }

  if (type === 'flat_monthly' && !monthlyHoursThreshold) {
    return { type: 'no_threshold', message: 'Add hours threshold to enable scope tracking.' };
  }

  if (type === 'flat_monthly' || type === 'package_based') {
    const allocatedHoursStr = type === 'flat_monthly' ? monthlyHoursThreshold : packageHours;
    if (!allocatedHoursStr) return { type: 'no_threshold', message: 'No allocation set.' };

    const pct = utilization.utilizationPercent;
    let label: string;
    let color: 'green' | 'amber' | 'red';

    if (pct < 70) {
      label = 'On track ✓';
      color = 'green';
    } else if (pct < 90) {
      label = 'Approaching threshold';
      color = 'amber';
    } else {
      label = 'Time to renegotiate';
      color = 'red';
    }

    return { type: 'trackable', percent: pct, label, color };
  }

  return null;
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { clientId } = await params;
  const search = await searchParams;
  const supabase = await getServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const workspaceId = user.app_metadata?.workspace_id as string | undefined;
  const role = user.app_metadata?.role as string | undefined;
  if (!workspaceId || !role) return notFound();

  const { type, range, cursor } = timelineSearchParamsCache.parse(search);

  const client = await getClientById(supabase, { clientId, workspaceId });
  if (!client) return notFound();

  const clientName = (client as { company_name?: string }).company_name ?? 'Client';
  const retainer = await getActiveRetainerForClient(supabase, { clientId, workspaceId });
  const allRetainers = await listRetainersForClient(supabase, { clientId, workspaceId });
  const historicalRetainers = allRetainers.filter((r) => r.status !== 'active');

  let utilizationResult = null;
  let utilizationState: UtilizationState | null = null;
  let isScopeAlert = false;

  if (retainer) {
    utilizationResult = await getRetainerUtilization(supabase, {
      retainerId: retainer.id,
      workspaceId,
    });
    utilizationState = deriveUtilizationState(
      retainer.type,
      retainer.monthlyHoursThreshold,
      retainer.packageHours,
      utilizationResult,
    );
    isScopeAlert = utilizationState?.type === 'trackable' && utilizationState.percent >= 90;
  }

  const toastCode = typeof search.toast_code === 'string' ? search.toast_code : undefined;
  const toastMsg = typeof search.toast_msg === 'string' ? search.toast_msg : undefined;
  const toastLinkLabel = typeof search.toast_link_label === 'string' ? search.toast_link_label : undefined;
  const toastLinkHref = typeof search.toast_link_href === 'string' ? search.toast_link_href : undefined;

  return (
    <div className="space-y-6">
      {toastCode && toastMsg && (
        <WizardToast code={toastCode} message={toastMsg} linkLabel={toastLinkLabel} linkHref={toastLinkHref} />
      )}
      {isScopeAlert && utilizationState && utilizationState.type === 'trackable' && (
        <RetainerScopeBanner clientName={clientName} utilizationPercent={utilizationState.percent} />
      )}
      <ClientHeader client={client as Client} role={role} />
      <ClientDetails client={client as Client} role={role} />
      <RetainerPanel
        retainer={retainer}
        utilization={utilizationState}
        clientId={clientId}
        role={role}
        billingPeriodEnd={utilizationResult?.billingPeriodEnd}
        clientName={clientName}
        overageMinutes={utilizationResult && utilizationResult.allocatedMinutes > 0 && utilizationResult.totalMinutes > utilizationResult.allocatedMinutes
          ? utilizationResult.totalMinutes - utilizationResult.allocatedMinutes
          : undefined}
        trackedMinutes={utilizationResult?.totalMinutes}
        historicalRetainers={historicalRetainers}
      />
      {(role === 'owner' || role === 'admin') && (
        <TeamAccessPanel clientId={clientId} workspaceId={workspaceId} />
      )}
      <InboxConnectionCard clientId={clientId} role={role} />

      <TimelineErrorBoundary>
        <Suspense fallback={<TimelineSkeleton />}>
          <TimelineSection 
            supabase={supabase}
            workspaceId={workspaceId}
            clientId={clientId}
            eventType={type as 'all' | 'emails' | 'agent_runs'}
            dateRange={range}
            cursor={cursor}
          />
        </Suspense>
      </TimelineErrorBoundary>
    </div>
  );
}

async function TimelineSection({
  supabase,
  workspaceId,
  clientId,
  eventType,
  dateRange,
  cursor,
}: {
  supabase: any;
  workspaceId: string;
  clientId: string;
  eventType: 'all' | 'emails' | 'agent_runs';
  dateRange: string;
  cursor: string | null;
}) {
  // P7: Validate dateRange against allowlist to prevent crafted URL params
  const ALLOWED_RANGES = new Set(['7d', '30d', '90d', 'all']);
  const safeRange = ALLOWED_RANGES.has(dateRange) ? dateRange : '90d';

  let dateFrom: string | undefined;
  if (safeRange !== 'all') {
    const days = parseInt(safeRange.replace('d', ''), 10);
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    date.setUTCHours(0, 0, 0, 0);
    dateFrom = date.toISOString();
  }

  const dateTo = new Date().toISOString();

  const timeline = await getClientEngagementTimeline(supabase, {
    workspaceId,
    clientId,
    eventType,
    ...(dateFrom ? { dateFrom } : {}),
    dateTo,
    ...(cursor != null ? { cursor } : {}),
    limit: 50,
  });

  return (
    <ClientTimeline 
      initialEvents={timeline.events}
      initialCursor={timeline.nextCursor}
      workspaceId={workspaceId}
      clientId={clientId}
      eventType={eventType}
      dateRange={dateRange}
    />
  );
}

