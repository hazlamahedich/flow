import { createServiceClient, insertSignal } from '@flow/db';
import type { ClientHealthInput, ClientHealthProposal, OverallHealth, HealthIndicators } from './schemas';
import {
  computeEngagementScore,
  computePaymentScore,
  computeCommunicationScore,
  computeOverallHealth,
  computeIndicators,
  type HealthInput,
} from './compute-health';

interface GatherResult {
  input: HealthInput;
  prevHealth: string | null;
}

async function gatherHealthData(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string,
  clientId: string,
  snapshotDate: string,
): Promise<GatherResult> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

  const [
    timeResult,
    emailResult,
    invoiceResult,
    clientResult,
    prevSnapshotResult,
  ] = await Promise.all([
    supabase
      .from('time_entries')
      .select('duration_minutes')
      .eq('workspace_id', workspaceId)
      .eq('client_id', clientId)
      .gte('created_at', thirtyDaysAgoStr),
    supabase
      .from('inbox_emails')
      .select('id, created_at')
      .eq('workspace_id', workspaceId)
      .eq('client_id', clientId)
      .gte('created_at', thirtyDaysAgoStr),
    supabase
      .from('invoices')
      .select('id, status, due_date, paid_at')
      .eq('workspace_id', workspaceId)
      .eq('client_id', clientId),
    supabase
      .from('clients')
      .select('id, created_at')
      .eq('workspace_id', workspaceId)
      .eq('id', clientId)
      .single(),
    supabase
      .from('client_health_snapshots')
      .select('overall_health')
      .eq('workspace_id', workspaceId)
      .eq('client_id', clientId)
      .neq('snapshot_date', snapshotDate)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const totalMinutes = (timeResult.data ?? []).reduce(
    (sum: number, e: { duration_minutes: number | null }) => sum + (e.duration_minutes ?? 0),
    0,
  );
  const timeEntryHours = totalMinutes / 60;

  const emailCount = (emailResult.data ?? []).length;

  const invoices = invoiceResult.data ?? [];
  const overdueInvoices = invoices.filter(
    (inv: { status: string; due_date: string | null }) =>
      inv.status !== 'paid' && inv.status !== 'void' && inv.due_date && new Date(inv.due_date) < new Date(),
  );
  const paidInvoices = invoices.filter(
    (inv: { paid_at: string | null }) => inv.paid_at !== null,
  );

  const daysSinceLastPayment = paidInvoices.length > 0
    ? Math.floor(
        (Date.now() - Math.max(...paidInvoices.map((inv: { paid_at: string }) => new Date(inv.paid_at!).getTime()))) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  const client = clientResult.data;
  const clientCreatedAt = client?.created_at ?? new Date().toISOString();

  const prevHealth = (prevSnapshotResult.data as { overall_health: string } | null)?.overall_health ?? null;

  const healthInput: HealthInput = {
    timeEntryHoursLast30d: timeEntryHours,
    emailExchangeCount: emailCount,
    meetingCount: 0,
    overdueInvoiceCount: overdueInvoices.length,
    daysSinceLastPayment,
    avgResponseTimeHours: 0,
    meetingBypassCount: 0,
    daysSinceLastContact: 0,
    unpaidInvoiceCount: overdueInvoices.length,
    timeEntryStreakDays: 0,
    lastInvoicePaidAt: paidInvoices.length > 0
      ? paidInvoices.sort(
          (a: { paid_at: string }, b: { paid_at: string }) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime(),
        )[0]!.paid_at
      : null,
    clientCreatedAt,
  };

  return { input: healthInput, prevHealth };
}

export async function execute(input: ClientHealthInput): Promise<ClientHealthProposal> {
  const supabase = createServiceClient();
  const { workspaceId, clientId, snapshotDate } = input;

  const { input: healthInput, prevHealth } = await gatherHealthData(supabase, workspaceId, clientId, snapshotDate);

  const engagementScore = computeEngagementScore(healthInput);
  const paymentScore = computePaymentScore(healthInput);
  const communicationScore = computeCommunicationScore(healthInput);
  // Pass snapshotDate as the reference date so computeOverallHealth is deterministic
  const referenceDate = new Date(snapshotDate + 'T12:00:00Z');
  const overallHealth: OverallHealth = computeOverallHealth(engagementScore, paymentScore, communicationScore, healthInput, referenceDate);
  const indicators: HealthIndicators = computeIndicators(healthInput);

  const { data: snapshotData, error: snapshotError } = await supabase.rpc('upsert_client_health_snapshot', {
    p_workspace_id: workspaceId,
    p_client_id: clientId,
    p_snapshot_date: snapshotDate,
    p_engagement_score: engagementScore,
    p_payment_score: paymentScore,
    p_communication_score: communicationScore,
    p_overall_health: overallHealth,
    p_indicators: indicators,
  });

  if (snapshotError) {
    throw new Error(`Failed to upsert health snapshot: ${snapshotError.message}`);
  }

  const snapshotId = snapshotData as string;
  let signalEmitted = false;

  if (prevHealth !== overallHealth) {
    try {
      await insertSignal({
        agentId: 'client-health',
        signalType: 'client.score_changed',
        workspaceId,
        clientId,
        correlationId: input.agentRunId,
        payload: {
          client_id: clientId,
          previous_health: prevHealth,
          current_health: overallHealth,
          engagement_score: engagementScore,
          payment_score: paymentScore,
          communication_score: communicationScore,
        },
      });
      signalEmitted = true;
    } catch {
      // Signal emission failure does not fail health computation
    }
  }

  return {
    snapshotId,
    clientId,
    engagementScore,
    paymentScore,
    communicationScore,
    overallHealth,
    indicators,
    signalEmitted,
  };
}
