import { createServiceClient } from '@flow/db';
import { TRUST_THRESHOLDS, NEW_WORKSPACE_TRUST, TrustLevel } from './schemas/trust';

export async function computeTrustLevel(
  workspaceId: string,
  clientInboxId: string
): Promise<TrustLevel> {
  const supabase = createServiceClient();

  const { data: metrics, error } = await supabase
    .from('inbox_trust_metrics')
    .select('metric_type, metric_value, sample_count')
    .eq('workspace_id', workspaceId)
    .eq('client_inbox_id', clientInboxId);

  if (error || !metrics || metrics.length === 0) {
    return NEW_WORKSPACE_TRUST as TrustLevel;
  }

  const recatMetric = metrics.find((m) => m.metric_type === 'recategorization_rate');
  const draftMetric = metrics.find((m) => m.metric_type === 'draft_acceptance_rate');

  const recatRate = recatMetric?.metric_value ?? 1;
  const recatSamples = recatMetric?.sample_count ?? 0;
  const draftRate = draftMetric?.metric_value ?? 0;
  const draftSamples = draftMetric?.sample_count ?? 0;

  // Trust 3: recat_rate ≤ 0.10 + samples ≥ 50 + draft_accept ≥ 0.80
  if (
    recatSamples >= TRUST_THRESHOLDS.MIN_SAMPLES_TRUST_3 &&
    recatRate <= TRUST_THRESHOLDS.MAX_RECAT_RATE_TRUST_3 &&
    draftSamples >= 10 && // Implicit minimum for draft samples to reach trust 3?
    draftRate >= TRUST_THRESHOLDS.MIN_DRAFT_ACCEPT_TRUST_3
  ) {
    return 3;
  }

  // Trust 2: recat_rate ≤ 0.15 + samples ≥ 20
  if (
    recatSamples >= TRUST_THRESHOLDS.MIN_SAMPLES_TRUST_2 &&
    recatRate <= TRUST_THRESHOLDS.MAX_RECAT_RATE_TRUST_2
  ) {
    return 2;
  }

  return 1;
}

export async function meetsDraftGate(workspaceId: string, clientInboxId: string): Promise<boolean> {
  const trustLevel = await computeTrustLevel(workspaceId, clientInboxId);
  return trustLevel >= TRUST_THRESHOLDS.DRAFT_TRUST_GATE;
}

export async function recordRecategorizationMetric(
  workspaceId: string,
  clientInboxId: string
): Promise<void> {
  const supabase = createServiceClient();

  // Get total processed emails for this client inbox
  const { count: totalEmails, error: totalError } = await supabase
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('client_inbox_id', clientInboxId);

  if (totalError) throw totalError;

  // Get recategorized emails for this client inbox using inner join
  const { count: recatCount, error: recatError } = await supabase
    .from('recategorization_log')
    .select('email_id, emails!inner(client_inbox_id)', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('emails.client_inbox_id', clientInboxId);

  if (recatError) throw recatError;

  const sampleCount = totalEmails ?? 0;
  const metricValue = sampleCount > 0 ? (recatCount ?? 0) / sampleCount : 0;

  const { error: upsertError } = await supabase.from('inbox_trust_metrics').upsert(
    {
      workspace_id: workspaceId,
      client_inbox_id: clientInboxId,
      metric_type: 'recategorization_rate',
      metric_value: metricValue,
      sample_count: sampleCount,
      computed_at: new Date().toISOString(),
    },
    {
      onConflict: 'workspace_id, client_inbox_id, metric_type',
    }
  );

  if (upsertError) throw upsertError;
}
