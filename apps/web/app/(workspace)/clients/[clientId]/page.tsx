import { getClientById, getActiveRetainerForClient, getRetainerUtilization } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import { ClientHeader } from './components/client-header';
import { ClientDetails } from './components/client-details';
import { RetainerPanel } from './components/retainer-panel';
import { RetainerScopeBanner } from './components/retainer-scope-banner';
import { WizardToast } from './components/wizard-toast';
import type { Client, UtilizationState } from '@flow/types';

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

  const client = await getClientById(supabase, { clientId, workspaceId });
  if (!client) return notFound();

  const clientName = (client as { company_name?: string }).company_name ?? 'Client';
  const retainer = await getActiveRetainerForClient(supabase, { clientId, workspaceId });

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
      />
    </div>
  );
}
