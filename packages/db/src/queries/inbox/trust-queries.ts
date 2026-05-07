import type { SupabaseClient } from '@supabase/supabase-js';

export async function updateInboxTrustMetric(
  supabase: SupabaseClient,
  workspaceId: string,
  clientInboxId: string,
  metricType: string,
  value: number,
  sampleCount: number,
): Promise<void> {
  const { error } = await supabase
    .from('inbox_trust_metrics')
    .upsert({
      workspace_id: workspaceId,
      client_inbox_id: clientInboxId,
      metric_type: metricType,
      metric_value: value,
      sample_count: sampleCount,
      computed_at: new Date().toISOString(),
    }, {
      onConflict: 'workspace_id,client_inbox_id,metric_type'
    });

  if (error) throw error;
}
